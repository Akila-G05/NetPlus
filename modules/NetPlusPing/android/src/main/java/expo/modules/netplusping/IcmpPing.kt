package expo.modules.netplusping

import java.net.DatagramSocket
import java.net.DatagramPacket
import java.net.InetAddress
import java.nio.ByteBuffer

/**
 * Lightweight ICMP echo-request / echo-reply ping built on [DatagramSocket].
 *
 * Unlike `ProcessBuilder("ping", …)` this approach:
 *  - Avoids spawning a child process on every probe (significant on low-end SoCs).
 *  - Returns immediately with a precise RTT instead of parsing stdout text.
 *  - Requires only the INTERNET permission — no root / CAP_NET_RAW needed because
 *    the kernel sends ICMP echo replies on behalf of the app for unprivileged
 *    datagrams on most Android 7+ devices.  On devices where it is blocked the
 *    caller should fall back to HTTP.
 */
object IcmpPing {

    private const val ICMP_ECHO_REQUEST = 8
    private const val ICMP_ECHO_REPLY   = 10
    private const val ICMP_HEADER_BYTES = 8

    /**
     * Send a single ICMP echo request and measure the round-trip time.
     *
     * @param host      target hostname or IP
     * @param timeoutMs maximum time to wait for a reply
     * @return RTT in milliseconds, or `null` on failure / timeout
     */
    fun ping(host: String, timeoutMs: Int): Double? {
        if (host.isBlank()) return null
        return try {
            val address = InetAddress.getByName(host)
            val id  = (Math.random() * Short.MAX_VALUE).toInt().toShort()
            val seq = 1

            // ── Build ICMP echo-request packet ──────────────────────
            // Type(1) | Code(1) | Checksum(2) | ID(2) | Seq(2) | payload
            val payload = ByteBuffer.allocate(64).putLong(System.nanoTime()).array()
            val packet  = ByteBuffer.allocate(ICMP_HEADER_BYTES + payload.size).apply {
                put(ICMP_ECHO_REQUEST.toByte())          // Type
                put(0)                                    // Code
                putShort(0)                               // Checksum (placeholder)
                putShort(id)                              // Identifier
                putShort(seq.toShort())                     // Sequence
                put(payload)
            }.array()

            // Internet checksum (RFC 1071)
            computeChecksum(packet)

            // ── Send & receive ──────────────────────────────────────
            val socket = DatagramSocket().apply {
                soTimeout = timeoutMs
            }
            try {
                socket.send(DatagramPacket(packet, packet.size, address, 0))

                val buf  = ByteArray(128)
                val resp = DatagramPacket(buf, buf.size)
                val t0   = System.nanoTime()
                socket.receive(resp)
                val rtt  = (System.nanoTime() - t0) / 1_000_000.0

                // Validate reply
                if (resp.length >= ICMP_HEADER_BYTES) {
                    val type = buf[0].toInt() and 0xFF
                    if (type == ICMP_ECHO_REPLY) return rtt
                }
                null
            } finally {
                socket.close()
            }
        } catch (_: Exception) {
            null
        }
    }

    // ── RFC 1071 Internet Checksum ──────────────────────────────────
    private fun computeChecksum(buf: ByteArray) {
        var sum = 0L
        var i = 0
        while (i + 1 < buf.size) {
            sum += ((buf[i].toInt() and 0xFF) shl 8) or (buf[i + 1].toInt() and 0xFF)
            i += 2
        }
        // Fold 32-bit carries into 16 bits
        while (sum shr 16 != 0L) {
            sum = (sum and 0xFFFF) + (sum shr 16)
        }
        val checksum = sum.toInt().inv() and 0xFFFF
        buf[2] = (checksum shr 8).toByte()
        buf[3] = (checksum and 0xFF).toByte()
    }
}
