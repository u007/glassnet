/**
 * DNS resolution utilities
 */

import { promisify } from 'util';
import { lookup, reverse } from 'dns';
import { isIP } from 'net';

const dnsLookup = promisify(lookup);
const dnsReverse = promisify(reverse);

export class DNSResolver {
  static cache = new Map();
  static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Resolve IP address to hostname with caching
   */
  static async resolveHostname(ip) {
    // Skip localhost/loopback addresses
    if (this.isLocalAddress(ip)) {
      return this.getLocalHostname(ip);
    }

    // Skip if not a valid IP address
    if (!isIP(ip)) {
      return ip;
    }

    // Check cache first
    const cached = this.cache.get(ip);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.hostname;
    }

    try {
      // Use reverse DNS lookup for IP addresses
      const hostnames = await dnsReverse(ip);
      const hostname = hostnames && hostnames.length > 0 ? hostnames[0] : null;
      
      if (hostname && hostname !== ip) {
        // Cache the successful result
        this.cache.set(ip, {
          hostname,
          timestamp: Date.now()
        });
        return hostname;
      } else {
        // If reverse lookup fails or returns the same IP, don't show hostname
        // Cache the failure to avoid repeated lookups
        this.cache.set(ip, {
          hostname: null,
          timestamp: Date.now()
        });
        return null;
      }
    } catch (error) {
      // If DNS resolution fails, cache the failure and don't show hostname
      this.cache.set(ip, {
        hostname: null,
        timestamp: Date.now()
      });
      return null;
    }
  }

  /**
   * Check if IP address is local/private
   */
  static isLocalAddress(ip) {
    if (!ip) return false;

    // IPv4 local addresses
    if (ip.match(/^127\./)) return true; // Loopback
    if (ip.match(/^10\./)) return true; // Private Class A
    if (ip.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)) return true; // Private Class B
    if (ip.match(/^192\.168\./)) return true; // Private Class C
    if (ip.match(/^169\.254\./)) return true; // Link-local

    // IPv6 local addresses
    if (ip === '::1') return true; // IPv6 loopback
    if (ip.startsWith('fe80:')) return true; // IPv6 link-local
    if (ip.startsWith('fc00:') || ip.startsWith('fd00:')) return true; // IPv6 unique local

    return false;
  }

  /**
   * Get descriptive name for local addresses
   */
  static getLocalHostname(ip) {
    if (ip === '127.0.0.1' || ip === '::1') {
      return 'localhost';
    }
    if (ip === '0.0.0.0' || ip === '::') {
      return 'any';
    }
    if (ip.startsWith('169.254.')) {
      return 'link-local';
    }
    if (this.isLocalAddress(ip)) {
      return 'local';
    }
    return ip;
  }

  /**
   * Batch resolve multiple IPs
   */
  static async resolveMultiple(ips) {
    const promises = ips.map(ip => 
      this.resolveHostname(ip).then(hostname => ({ ip, hostname }))
    );

    try {
      return await Promise.all(promises);
    } catch (error) {
      console.error('Batch DNS resolution error:', error);
      return ips.map(ip => ({ ip, hostname: ip }));
    }
  }

  /**
   * Clear DNS cache
   */
  static clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    const now = Date.now();
    const validEntries = Array.from(this.cache.values())
      .filter(entry => now - entry.timestamp < this.cacheTimeout);

    return {
      totalEntries: this.cache.size,
      validEntries: validEntries.length,
      cacheHitRate: this.cache.size > 0 ? validEntries.length / this.cache.size : 0
    };
  }

  /**
   * Clean expired cache entries
   */
  static cleanExpiredCache() {
    const now = Date.now();
    for (const [ip, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.cacheTimeout) {
        this.cache.delete(ip);
      }
    }
  }
}
