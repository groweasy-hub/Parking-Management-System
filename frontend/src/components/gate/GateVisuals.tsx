"use client";

import { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * 2 Wheeler Visual: Sleek blue scooter / motorbike
 */
export function TwoWheelerIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 110" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Ground shadow */}
      <ellipse cx="80" cy="98" rx="60" ry="7" fill="#E2E8F0" />
      {/* Rear Wheel */}
      <circle cx="42" cy="80" r="19" fill="#1E293B" />
      <circle cx="42" cy="80" r="11" fill="#94A3B8" />
      <circle cx="42" cy="80" r="4" fill="#0F172A" />
      {/* Front Wheel */}
      <circle cx="120" cy="80" r="19" fill="#1E293B" />
      <circle cx="120" cy="80" r="11" fill="#94A3B8" />
      <circle cx="120" cy="80" r="4" fill="#0F172A" />
      {/* Frame & Exhaust */}
      <path d="M42 80L62 70L80 82L105 82L120 80" stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
      <rect x="30" y="74" width="28" height="6" rx="3" fill="#475569" transform="rotate(-10 30 74)" />
      {/* Engine & Body underbody */}
      <path d="M52 75Q68 85 86 78L88 64Q70 60 56 68Z" fill="#334155" />
      {/* Main Scooter Body - Royal Blue */}
      <path d="M45 62Q55 45 74 48L96 58Q90 76 74 76L52 74Q44 68 45 62Z" fill="#1D4ED8" />
      {/* Footrest Floorboard */}
      <path d="M68 74L94 74L92 68L72 68Z" fill="#0F172A" />
      {/* Front Apron Shield */}
      <path d="M92 68L106 38Q114 36 118 42L112 72Q102 75 92 68Z" fill="#2563EB" />
      <path d="M106 38L114 34L118 42L112 52Z" fill="#60A5FA" />
      {/* Seat */}
      <path d="M40 50Q52 46 66 48Q78 50 82 56L50 56Q40 54 40 50Z" fill="#0F172A" rx="4" />
      {/* Handlebar & Headlight */}
      <path d="M106 38L104 22L100 20" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
      <path d="M98 22H112" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
      <path d="M112 36L118 34L117 40Z" fill="#FEF08A" />
      <circle cx="114" cy="37" r="3" fill="#FACC15" />
      {/* Front Mudguard */}
      <path d="M108 68Q120 62 130 72" stroke="#2563EB" strokeWidth="6" strokeLinecap="round" />
      {/* Mirror */}
      <circle cx="98" cy="17" r="3" fill="#94A3B8" stroke="#0F172A" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * 4 Wheeler Visual: Modern white / silver sedan car
 */
export function FourWheelerIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 170 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Ground shadow */}
      <ellipse cx="85" cy="88" rx="68" ry="7" fill="#E2E8F0" />
      {/* Rear Wheel */}
      <circle cx="44" cy="74" r="16" fill="#1E293B" />
      <circle cx="44" cy="74" r="9" fill="#94A3B8" />
      <circle cx="44" cy="74" r="3" fill="#0F172A" />
      {/* Front Wheel */}
      <circle cx="126" cy="74" r="16" fill="#1E293B" />
      <circle cx="126" cy="74" r="9" fill="#94A3B8" />
      <circle cx="126" cy="74" r="3" fill="#0F172A" />
      {/* Car Body Under-sill */}
      <path d="M22 68L34 74H56L62 68H110L116 74H138L148 66L150 58H20L22 68Z" fill="#CBD5E1" />
      {/* Main Car Body - Pearl White / Light Gray */}
      <path
        d="M20 58L22 50Q28 42 42 42L60 42L76 28Q82 24 96 24L124 24Q134 26 138 36L148 48L156 50Q160 52 160 58L154 64H16L20 58Z"
        fill="#F8FAFC"
        stroke="#94A3B8"
        strokeWidth="1.5"
      />
      {/* Roof & Windows */}
      <path
        d="M74 42L84 28H122L132 42H74Z"
        fill="#38BDF8"
        fillOpacity="0.4"
        stroke="#64748B"
        strokeWidth="1.5"
      />
      {/* Window Pillar */}
      <line x1="102" y1="28" x2="102" y2="42" stroke="#64748B" strokeWidth="2" />
      {/* Headlights */}
      <path d="M152 50L158 52L154 58H148L152 50Z" fill="#FACC15" />
      {/* Taillights */}
      <path d="M18 52L24 50V56H18V52Z" fill="#EF4444" />
      {/* Door handle */}
      <rect x="88" y="47" width="7" height="2" rx="1" fill="#64748B" />
      <rect x="112" y="47" width="7" height="2" rx="1" fill="#64748B" />
      {/* Front bumper grille */}
      <path d="M156 58L158 64H150L148 58H156Z" fill="#475569" />
    </svg>
  );
}

/**
 * Others Visual: Delivery Truck / Commercial Van
 */
export function OthersIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 170 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Ground shadow */}
      <ellipse cx="85" cy="88" rx="68" ry="7" fill="#E2E8F0" />
      {/* Wheels */}
      <circle cx="48" cy="74" r="16" fill="#1E293B" />
      <circle cx="48" cy="74" r="9" fill="#94A3B8" />
      <circle cx="48" cy="74" r="3" fill="#0F172A" />
      <circle cx="128" cy="74" r="16" fill="#1E293B" />
      <circle cx="128" cy="74" r="9" fill="#94A3B8" />
      <circle cx="128" cy="74" r="3" fill="#0F172A" />
      {/* Truck Cargo Box */}
      <rect
        x="22"
        y="24"
        width="82"
        height="46"
        rx="3"
        fill="#F1F5F9"
        stroke="#94A3B8"
        strokeWidth="1.5"
      />
      <line x1="62" y1="24" x2="62" y2="70" stroke="#CBD5E1" strokeWidth="1.5" />
      {/* Cabin */}
      <path
        d="M104 36H126Q134 38 140 48L148 58Q150 62 150 68V70H104V36Z"
        fill="#FFFFFF"
        stroke="#94A3B8"
        strokeWidth="1.5"
      />
      {/* Cabin Window */}
      <path
        d="M110 40H126L134 52H110V40Z"
        fill="#38BDF8"
        fillOpacity="0.4"
        stroke="#64748B"
        strokeWidth="1.5"
      />
      {/* Headlight */}
      <rect x="146" y="60" width="5" height="6" rx="1" fill="#FACC15" />
      {/* Bumper */}
      <rect x="144" y="68" width="8" height="6" rx="1" fill="#475569" />
    </svg>
  );
}

/**
 * Gate Barrier Boom & Guard Booth Illustration (matches bottom of Image 1)
 */
export function BoomBarrierSceneIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 360 110" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Soft Background Road & Greenery */}
      <path d="M0 100H360" stroke="#E2E8F0" strokeWidth="2" />
      {/* Soft Hills/Trees in background */}
      <circle cx="46" cy="85" r="22" fill="#E0F2FE" />
      <circle cx="68" cy="82" r="26" fill="#BAE6FD" />
      <circle cx="310" cy="84" r="24" fill="#E0F2FE" />
      <circle cx="330" cy="82" r="26" fill="#BAE6FD" />

      {/* Guard Booth (Cabin) on Right */}
      <rect x="244" y="32" width="70" height="68" rx="4" fill="#F0F9FF" stroke="#BAE6FD" strokeWidth="1.5" />
      {/* Roof */}
      <path d="M238 32L246 22H312L320 32H238Z" fill="#1D4ED8" />
      {/* Window */}
      <rect x="256" y="44" width="46" height="28" rx="2" fill="#BAE6FD" fillOpacity="0.5" stroke="#93C5FD" strokeWidth="1.5" />
      <line x1="279" y1="44" x2="279" y2="72" stroke="#93C5FD" strokeWidth="1.5" />

      {/* Car Arriving (silhouette in center-left) */}
      <g opacity="0.35">
        <rect x="142" y="62" width="56" height="24" rx="6" fill="#3B82F6" />
        <path d="M150 62L156 50H184L190 62H150Z" fill="#3B82F6" />
        <circle cx="152" cy="86" r="6" fill="#1E293B" />
        <circle cx="188" cy="86" r="6" fill="#1E293B" />
        <circle cx="146" cy="72" r="3" fill="#FACC15" />
        <circle cx="194" cy="72" r="3" fill="#FACC15" />
      </g>

      {/* Boom Barrier Post (Blue stanchion) */}
      <rect x="88" y="48" width="22" height="52" rx="4" fill="#2563EB" />
      <circle cx="99" cy="58" r="5" fill="#DBEAFE" />

      {/* Barrier Arm with Red & White diagonal stripes */}
      <g>
        {/* Main arm bar */}
        <rect x="104" y="54" width="128" height="8" rx="3" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
        {/* Red stripes */}
        <rect x="114" y="54" width="12" height="8" fill="#EF4444" />
        <rect x="138" y="54" width="12" height="8" fill="#EF4444" />
        <rect x="162" y="54" width="12" height="8" fill="#EF4444" />
        <rect x="186" y="54" width="12" height="8" fill="#EF4444" />
        <rect x="210" y="54" width="12" height="8" fill="#EF4444" />
      </g>
    </svg>
  );
}

/**
 * Gateman / Officer Cap Icon
 */
export function OfficerCapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Cap Crown */}
      <path d="M4 10C4 6 7.5 4 12 4C16.5 4 20 6 20 10L21 13H3L4 10Z" />
      {/* Visor / Peak */}
      <path d="M2 13C4 16 8 18 12 18C16 18 20 16 22 13H2Z" fillOpacity="0.8" />
      {/* Badge on Cap */}
      <circle cx="12" cy="8.5" r="1.8" fill="#FACC15" />
      {/* Chin / collar silhouette */}
      <path d="M8 18V20C8 20 9.5 21 12 21C14.5 21 16 20 16 20V18C14.8 19 13.5 19.5 12 19.5C10.5 19.5 9.2 19 8 18Z" opacity="0.6" />
    </svg>
  );
}

/**
 * Parking P + Car Available Icon (Image 3 Green Circle)
 */
export function ParkingAvailableCenterIcon({ className }: { className?: string } = {}) {
  return (
    <div
      className={cn(
        "mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#16a34a] text-white shadow-lg shadow-emerald-600/25",
        className
      )}
    >
      <div className="flex flex-col items-center justify-center">
        <span className="font-black text-3xl leading-none">P</span>
        <svg className="h-4 w-6 mt-0.5" viewBox="0 0 24 16" fill="currentColor">
          <path d="M3 10L5 4H19L21 10V14H19V12H5V14H3V10Z" />
          <circle cx="7" cy="11" r="1.5" fill="#16a34a" />
          <circle cx="17" cy="11" r="1.5" fill="#16a34a" />
        </svg>
      </div>
    </div>
  );
}

/**
 * No Parking P + Ban Icon (Red Circle for No Parking Space Available)
 */
export function ParkingNotAvailableCenterIcon({ className }: { className?: string } = {}) {
  return (
    <div
      className={cn(
        "mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/25",
        className
      )}
    >
      <div className="relative flex flex-col items-center justify-center">
        <span className="font-black text-3xl leading-none">P</span>
        <svg className="h-4 w-6 mt-0.5" viewBox="0 0 24 16" fill="currentColor">
          <path d="M3 10L5 4H19L21 10V14H19V12H5V14H3V10Z" />
          <circle cx="7" cy="11" r="1.5" fill="#e11d48" />
          <circle cx="17" cy="11" r="1.5" fill="#e11d48" />
        </svg>
        {/* Diagonal Ban Slash */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-1 bg-white transform -rotate-45 rounded-full shadow-xs" />
        </div>
      </div>
    </div>
  );
}

