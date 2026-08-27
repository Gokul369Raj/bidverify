"use client";
import Image from "next/image";

/**
 * Fullscreen ambient hero image (Pexels, free license).
 * Covers the entire hero viewport; content renders above it.
 * Rendered via next/image for AVIF/WebP optimization and reserved space (no CLS).
 */
export default function HeroImage() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Image
        src="https://images.pexels.com/photos/1108101/pexels-photo-1108101.jpeg?auto=compress&cs=tinysrgb&w=2400"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* Legibility scrims — top for nav blend, bottom for content */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black via-black/60 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />
    </div>
  );
}
