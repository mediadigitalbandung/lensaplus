"use client";

import { slotLabels, slotSpecs } from "./ad-constants";

const AD = "bg-primary/15 border-2 border-dashed border-primary text-primary font-bold flex items-center justify-center rounded-lg";

function Slot({ on, label, className }: { on: boolean; label: string; className?: string }) {
  if (!on) return null;
  return <div className={`${AD} text-[7px] sm:text-[8px] ${className || ""}`}><span className="text-center leading-tight">{label}</span></div>;
}

/* tiny helpers */
const Bar = ({ w, c = "bg-[#d1d5db]" }: { w: string; c?: string }) => <div className={`h-[3px] rounded-lg ${c}`} style={{ width: w }} />;
const ImgBox = ({ h = 24, className = "" }: { h?: number; className?: string }) => (
  <div className={`rounded-lg bg-gradient-to-br from-[#e2e4e7] to-[#cfd2d6] ${className}`} style={{ height: h }} />
);

export default function SlotWireframe({ slot }: { slot: string }) {
  const spec = slotSpecs[slot];

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-card">
      <h3 className="text-sm font-bold text-txt-primary mb-1">Posisi di Halaman</h3>
      <p className="text-xs text-txt-muted mb-3">Area hijau = lokasi iklan di website</p>

      <div className="relative rounded-lg overflow-hidden border border-[#d1d5db] shadow-sm bg-white" style={{ fontSize: 0 }}>

        {/* ── Browser Chrome ── */}
        <div className="flex items-center gap-1.5 bg-[#f1f1f1] px-2 py-1">
          <span className="h-[5px] w-[5px] rounded-full bg-[#ff5f57]" />
          <span className="h-[5px] w-[5px] rounded-full bg-[#febc2e]" />
          <span className="h-[5px] w-[5px] rounded-full bg-[#28c840]" />
          <div className="flex-1 h-3 rounded-full bg-white ml-1.5 px-2 flex items-center">
            <span className="text-[6px] text-[#aaa]">145.79.15.99.nip.io</span>
          </div>
        </div>

        {/* ── Header Dark ── */}
        <div className="bg-[#1C1C1E] px-2.5 py-1.5 flex items-center">
          <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="text-[4px] font-extrabold text-white">Kartawarta</span>
          </div>
          <div className="ml-1.5 leading-none">
            <span className="text-[7px] font-bold text-white block">Kartawarta</span>
            <span className="text-[5px] text-white/40">Bandung</span>
          </div>
          <div className="flex-1" />
          <div className="h-[10px] w-[52px] rounded-full bg-white/10 mr-1.5 flex items-center px-1">
            <span className="text-[4px] text-white/30">Cari di sini...</span>
          </div>
          <span className="text-[5px] text-white/50 mr-1">Bookmark</span>
          <div className="h-3.5 w-3.5 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[5px] text-white font-bold">S</span>
          </div>
        </div>

        {/* ── Category Nav ── */}
        <div className="bg-white border-b border-[#e5e7eb] px-2.5 py-[3px] flex gap-[6px]">
          {["Terkini", "H.Pidana", "H.Perdata", "Tata Negara", "HAM", "H.Bisnis", "Opini", "Daerah"].map((c, i) => (
            <span key={c} className={`text-[5px] whitespace-nowrap ${i === 0 ? "text-primary font-bold border-b border-primary" : "text-[#6B7280] font-medium"}`}>{c}</span>
          ))}
        </div>

        {/* ── Trending Ticker ── */}
        <div className="bg-white border-b border-[#e5e7eb] px-2.5 py-[2px] flex items-center gap-1 overflow-hidden">
          <span className="text-[4px] font-bold text-primary tracking-widest shrink-0">TRENDING</span>
          {["Reformasi Intelijen", "Unhan", "HAM Operasi Intelijen"].map(t => (
            <span key={t} className="flex items-center gap-[2px] text-[4px] text-[#6B7280] whitespace-nowrap shrink-0">
              <span className="h-[2px] w-[2px] rounded-full bg-primary" />{t}
            </span>
          ))}
        </div>

        {/* ── HEADER AD ── */}
        <Slot on={slot === "HEADER"} label={`IKLAN — ${spec?.ratio}`} className="h-[18px] mx-2 mt-1" />

        {/* ── Headline Slider + Breaking ── 2/3 + 1/3 */}
        <div className="px-2 mt-1 flex gap-1.5">
          {/* Headline slider */}
          <div className="flex-[2] rounded-lg overflow-hidden relative" style={{ height: 55 }}>
            <div className="absolute inset-0 bg-gradient-to-t from-[#1C1C1E] via-[#1C1C1E]/60 to-transparent rounded-lg" />
            <ImgBox h={55} className="rounded-lg" />
            <div className="absolute bottom-1 left-1.5 right-1.5">
              <div className="h-[3px] w-6 rounded-full bg-primary mb-[3px]" />
              <Bar w="80%" c="bg-white/70" />
              <div className="mt-[2px]"><Bar w="50%" c="bg-white/40" /></div>
            </div>
          </div>
          {/* Breaking news */}
          <div className="flex-[1] rounded-lg border border-[#e5e7eb] bg-white p-1 flex flex-col">
            <div className="flex items-center gap-[3px] mb-1">
              <span className="h-[3px] w-[3px] rounded-full bg-red-500 animate-pulse" />
              <span className="text-[5px] font-bold text-red-500">Breaking</span>
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="mb-1 pb-1 border-b border-[#f3f4f6] last:border-0">
                <Bar w={`${85 - i * 10}%`} c="bg-[#1C1C1E]/20" />
                <div className="mt-[2px]"><Bar w="40%" c="bg-[#1C1C1E]/10" /></div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BETWEEN SECTIONS AD ── */}
        <Slot on={slot === "BETWEEN_SECTIONS"} label={`IKLAN — ${spec?.ratio}`} className="h-[18px] mx-2 mt-1.5" />

        {/* ── Berita Terkini (3/5) + Terpopuler (2/5) ── */}
        <div className="px-2 mt-1.5 flex gap-1.5">
          {/* Terkini — 2-column grid */}
          <div className="flex-[3] min-w-0">
            <div className="flex items-center justify-between mb-[3px]">
              <div className="flex items-center gap-[2px]">
                <div className="w-[2px] h-[8px] bg-primary rounded-full" />
                <span className="text-[6px] font-bold text-[#1C1C1E]">Berita Terkini</span>
              </div>
              <span className="text-[4px] text-primary font-medium">Lihat Semua</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-lg border border-[#e5e7eb] bg-white overflow-hidden">
                  <ImgBox h={20} className="rounded-t" />
                  <div className="p-[3px] space-y-[2px]">
                    <Bar w="90%" c="bg-[#1C1C1E]/20" />
                    <Bar w="60%" c="bg-[#1C1C1E]/10" />
                    <div className="flex gap-[3px] items-center">
                      <span className="h-[2px] w-[10px] rounded-full bg-primary/40" />
                      <Bar w="20px" c="bg-[#9CA3AF]/20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── IN-ARTICLE AD ── */}
            <Slot on={slot === "IN_ARTICLE"} label={`IKLAN — ${spec?.ratio}`} className="h-[14px] mt-1" />
          </div>

          {/* Terpopuler — numbered vertical list */}
          <div className="flex-[2] min-w-0">
            {slot === "SIDEBAR" ? (
              <div className={`${AD} min-h-[80px] text-[7px] p-1 text-center leading-tight`}>
                IKLAN<br />{spec?.ratio}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-[2px] mb-[3px]">
                  <div className="w-[2px] h-[8px] bg-primary rounded-full" />
                  <span className="text-[6px] font-bold text-[#1C1C1E]">Terpopuler</span>
                </div>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-[3px] py-[2px] border-b border-[#f3f4f6]">
                    <span className="text-[8px] font-extrabold text-primary w-[10px] text-center shrink-0">{i}</span>
                    <ImgBox h={14} className="w-[20px] shrink-0 rounded-sm" />
                    <div className="flex-1 min-w-0 space-y-[1px]">
                      <Bar w={`${90 - i * 5}%`} c="bg-[#1C1C1E]/20" />
                      <div className="flex gap-[2px]">
                        <span className="h-[2px] w-[8px] rounded-full bg-primary/40" />
                        <Bar w="12px" c="bg-[#9CA3AF]/20" />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Jadwal Sidang — horizontal scroll cards ── */}
        <div className="px-2 mt-1.5">
          <div className="flex items-center gap-[2px] mb-[3px]">
            <div className="w-[2px] h-[8px] bg-primary rounded-full" />
            <span className="text-[6px] font-bold text-[#1C1C1E]">Jadwal Sidang</span>
          </div>
          <div className="flex gap-1 overflow-hidden">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="shrink-0 w-[50px] rounded-lg border border-[#e5e7eb] bg-white p-[3px]">
                <div className="flex items-center gap-[2px] mb-[2px]">
                  <div className="h-[10px] w-[10px] rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-[4px] font-bold text-white">{i + 2}</span>
                  </div>
                  <div>
                    <Bar w="18px" c="bg-[#1C1C1E]/20" />
                  </div>
                </div>
                <Bar w="90%" c="bg-[#1C1C1E]/10" />
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER AD ── */}
        <Slot on={slot === "FOOTER"} label={`IKLAN — ${spec?.ratio}`} className="h-[14px] mx-2 mt-1.5" />

        {/* ── Dark Footer ── */}
        <div className="bg-[#1C1C1E] mt-1.5 px-2.5 py-2">
          <div className="flex gap-4">
            <div>
              <div className="flex items-center gap-1 mb-[3px]">
                <div className="h-[8px] w-[8px] rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[3px] text-white font-bold">Kartawarta</span>
                </div>
                <span className="text-[5px] font-bold text-white">Kartawarta</span>
              </div>
              <Bar w="50px" c="bg-white/10" />
              <div className="mt-[2px]"><Bar w="40px" c="bg-white/10" /></div>
            </div>
            <div>
              <span className="text-[4px] font-bold text-white/30 uppercase block mb-[2px]">Tentang</span>
              <Bar w="28px" c="bg-white/10" />
              <div className="mt-[2px]"><Bar w="22px" c="bg-white/10" /></div>
              <div className="mt-[2px]"><Bar w="32px" c="bg-white/10" /></div>
            </div>
            <div>
              <span className="text-[4px] font-bold text-white/30 uppercase block mb-[2px]">Kontak</span>
              <Bar w="28px" c="bg-white/10" />
              <div className="mt-[2px]"><Bar w="24px" c="bg-white/10" /></div>
              <div className="mt-[2px]"><Bar w="30px" c="bg-white/10" /></div>
            </div>
          </div>
          <div className="mt-1.5 pt-1 border-t border-white/10 flex justify-between">
            <span className="text-[3px] text-white/20">2026 Kartawarta</span>
            <span className="text-[3px] text-white/20">Dewan Pers Indonesia</span>
          </div>
        </div>

        {/* ── Floating Bottom ── */}
        {slot === "FLOATING_BOTTOM" && (
          <div className="absolute bottom-[28px] left-2 right-2 z-10">
            <div className={`${AD} h-[16px] text-[7px] shadow-lg bg-white/90 backdrop-blur rounded-md`}>
              IKLAN FLOATING — {spec?.ratio}
            </div>
          </div>
        )}

        {/* ── Popup ── */}
        {slot === "POPUP" && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <div className={`${AD} rounded-lg px-3 py-5 text-[8px] shadow-2xl bg-white/95`}>
              POP-UP IKLAN<br />{spec?.ratio}
            </div>
          </div>
        )}
      </div>

      {/* ── Spec Summary ── */}
      <div className="mt-4 rounded-lg bg-primary-light/50 p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-txt-primary">{slotLabels[slot]}</span>
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-white">{spec?.ratio}</span>
        </div>
        <p className="text-xs text-txt-secondary">{spec?.desc}</p>
        <div className="flex gap-3 text-[10px] text-txt-muted">
          <span>Lebar: {spec?.width}px</span>
          <span>Tinggi: {spec?.height}px</span>
          <span>Format: JPG, PNG, GIF</span>
        </div>
      </div>
    </div>
  );
}
