// apps/web/src/components/ui/ui.test.tsx
// Tes komponen UI bersama pasca-redesign v2.0 (docs/redesign-v20-spec.md
// §9): Button (hierarki varian + nonaktif eksplisit K-53, tanpa
// kelas opasitas), StatusBadge (warna dari helper status-warna + label
// teks selalu ada), Card (varian status bertinta bermakna), EmptyState
// (dirancang + ikon netral bawaan), MeterStrip (zona warna 80/50
// + penanda warna status), Skeleton (pola meniru tata letak akhir).
// Pola pasang mengikuti MasukPage.test.tsx (react-dom/client + act,
// tanpa testing-library); tidak ada panggilan jaringan.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { MeterStrip } from "./MeterStrip";
import { Skeleton, SkeletonText } from "./Skeleton";
import { StatusBadge } from "./StatusBadge";

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("Komponen UI v2.0", () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;

  function pasang(node: React.ReactNode): void {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    act(() => {
      root?.render(node);
    });
  }

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    if (wadah) {
      wadah.remove();
    }
    wadah = null;
  });

  function tombol(): HTMLButtonElement {
    const el = wadah?.querySelector("button");
    expect(el).not.toBeNull();
    return el as HTMLButtonElement;
  }

  describe("Button", () => {
    it("primer: latar putih teks hitam, klik memanggil onClick", () => {
      const klik = vi.fn();
      pasang(<Button onClick={klik}>Periksa sekarang</Button>);
      const el = tombol();
      expect(el.textContent).toBe("Periksa sekarang");
      expect(el.className).toContain("bg-white");
      expect(el.className).toContain("text-black");
      expect(el.disabled).toBe(false);
      act(() => {
        el.click();
      });
      expect(klik).toHaveBeenCalledTimes(1);
    });

    it("danger: merah solid + teks putih (bukan garis merah)", () => {
      pasang(<Button variant="danger">Hapus</Button>);
      const el = tombol();
      expect(el.className).toContain("bg-[var(--color-error-solid)]");
      expect(el.className).toContain("text-white");
    });

    it("secondary: bingkai Zinc 500, ghost: tanpa latar", () => {
      pasang(
        <>
          <Button variant="secondary">Batal</Button>
          <Button variant="ghost">Lewati</Button>
        </>,
      );
      const tombolSemua = wadah?.querySelectorAll("button") ?? [];
      expect(tombolSemua).toHaveLength(2);
      expect(tombolSemua[0]?.className).toContain(
        "border-[var(--color-border-strong)]",
      );
      expect(tombolSemua[1]?.className).toContain("bg-transparent");
    });

    it("nonaktif: gaya eksplisit tanpa kelas opasitas (K-53)", () => {
      pasang(
        <Button variant="danger" disabled>
          Hapus
        </Button>,
      );
      const el = tombol();
      expect(el.disabled).toBe(true);
      expect(el.className).not.toContain("opacity-50");
      expect(el.className).toContain("disabled:bg-[var(--color-surface-hover)]");
      expect(el.className).toContain("disabled:text-[var(--color-text-disabled)]");
    });

    it("loading: aria-busy + spinner, tombol terkunci", () => {
      pasang(<Button loading>Menyimpan</Button>);
      const el = tombol();
      expect(el.disabled).toBe(true);
      expect(el.getAttribute("aria-busy")).toBe("true");
      expect(el.querySelector("svg")).not.toBeNull();
      expect(el.textContent).toContain("Menyimpan");
    });

    it("target sentuh minimal 48 px dan label satu baris", () => {
      pasang(<Button>Periksa</Button>);
      const el = tombol();
      expect(el.className).toContain("min-h-[48px]");
      expect(el.className).toContain("whitespace-nowrap");
    });
  });

  describe("StatusBadge", () => {
    it.each([
      ["sukses", "var(--color-success-bg)", "Baik"],
      ["galat", "var(--color-error-bg)", "Bermasalah"],
      ["peringatan", "var(--color-warning-bg)", "Perlu diperhatikan"],
      ["info", "var(--color-info-bg)", "Info"],
      ["netral", "var(--color-surface)", "Netral"],
    ] as const)(
      "varian %s memakai token latar helper + label teks",
      (status, tokenLatar, label) => {
        pasang(<StatusBadge status={status}>{label}</StatusBadge>);
        const el = wadah?.querySelector("span");
        expect(el?.textContent).toBe(label);
        expect(el?.getAttribute("style") ?? "").toContain(tokenLatar);
      },
    );

    it("dot hanya penanda tambahan, tidak pernah tanpa label", () => {
      pasang(<StatusBadge status="sukses" dot>Live</StatusBadge>);
      const el = wadah?.querySelector("span");
      expect(el?.textContent).toBe("Live");
      const titik = el?.querySelector("span[aria-hidden='true']");
      expect(titik).not.toBeNull();
    });
  });

  describe("Card", () => {
    it("netral: permukaan token tanpa bingkai status", () => {
      pasang(<Card>Isi kartu</Card>);
      const el = wadah?.querySelector("div");
      expect(el?.textContent).toBe("Isi kartu");
      expect(el?.className).toContain("bg-[var(--color-surface)]");
      expect(el?.className).not.toContain("border");
    });

    it("status galat: tinta + bingkai token galat (bermakna)", () => {
      pasang(<Card status="galat">Bermasalah</Card>);
      const el = wadah?.querySelector("div");
      const gaya = el?.getAttribute("style") ?? "";
      expect(gaya).toContain("var(--color-error-bg)");
      expect(gaya).toContain("var(--color-error-border)");
      expect(el?.className).toContain("border");
    });

    it("status netral sama dengan kartu netral (tanpa tinta)", () => {
      pasang(<Card status="netral">Netral</Card>);
      const el = wadah?.querySelector("div");
      expect(el?.getAttribute("style")).toBeNull();
    });
  });

  describe("EmptyState", () => {
    it("judul + penjelasan + aksi, dengan ikon netral bawaan", () => {
      pasang(
        <EmptyState
          title="Belum ada riwayat"
          description="Jalankan pemeriksaan pertama untuk melihat skor di sini."
          action={<Button>Mulai pemeriksaan</Button>}
        />,
      );
      const teks = wadah?.textContent ?? "";
      expect(teks).toContain("Belum ada riwayat");
      expect(teks).toContain("Jalankan pemeriksaan pertama");
      expect(teks).toContain("Mulai pemeriksaan");
      // Ikon bawaan: SVG geometri di dalam sumur lingkaran.
      expect(wadah?.querySelector("svg")).not.toBeNull();
    });

    it("ikon dari pemanggil menggantikan ikon bawaan", () => {
      pasang(
        <EmptyState
          title="Kosong"
          description="Tidak ada apa-apa."
          icon={<span data-testid="ikon-kustom">I</span>}
        />,
      );
      expect(
        wadah?.querySelector('[data-testid="ikon-kustom"]'),
      ).not.toBeNull();
      expect(wadah?.querySelector("svg")).toBeNull();
    });
  });

  describe("MeterStrip", () => {
    it("tanpa nilai: dekoratif, disembunyikan dari pembaca layar", () => {
      pasang(<MeterStrip />);
      const svg = wadah?.querySelector("svg");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("role")).toBeNull();
    });

    it("tiga zona warna dari ambang 80/50 (K-31), digambar SVG", () => {
      pasang(<MeterStrip value={72} />);
      const svg = wadah?.querySelector("svg");
      const zona = svg?.querySelectorAll("rect") ?? [];
      expect(zona).toHaveLength(3);
      expect(zona[0]?.getAttribute("fill")).toBe("var(--color-error-bg)");
      expect(zona[1]?.getAttribute("fill")).toBe("var(--color-warning-bg)");
      expect(zona[2]?.getAttribute("fill")).toBe("var(--color-success-bg)");
    });

    it("nilai 72: label aria menyebut nilai + kategori kuning", () => {
      pasang(<MeterStrip value={72} />);
      const svg = wadah?.querySelector("svg");
      expect(svg?.getAttribute("role")).toBe("img");
      expect(svg?.getAttribute("aria-label")).toBe(
        "Nilai 72 dari 100, Perlu diperhatikan",
      );
      // Penanda nilai memakai warna status (kuning untuk 50-79).
      const garis = svg?.querySelectorAll("line") ?? [];
      const penanda = garis[garis.length - 1];
      expect(penanda?.getAttribute("stroke")).toBe("var(--color-warning)");
    });

    it("nilai 90 hijau, nilai 30 merah (ambang 80/50)", () => {
      pasang(<MeterStrip value={90} />);
      const svgBaik = wadah?.querySelector("svg");
      expect(svgBaik?.getAttribute("aria-label")).toContain("Baik");
      const garisBaik = svgBaik?.querySelectorAll("line") ?? [];
      expect(
        garisBaik[garisBaik.length - 1]?.getAttribute("stroke"),
      ).toBe("var(--color-success)");
    });

    it("nilai 30: kategori merah", () => {
      pasang(<MeterStrip value={30} />);
      const svg = wadah?.querySelector("svg");
      expect(svg?.getAttribute("aria-label")).toBe(
        "Nilai 30 dari 100, Bermasalah",
      );
      const garis = svg?.querySelectorAll("line") ?? [];
      expect(garis[garis.length - 1]?.getAttribute("stroke")).toBe(
        "var(--color-error)",
      );
    });
  });

  describe("Skeleton", () => {
    it("blok kerangka: role status + teks sr-only, ukuran dari pemanggil", () => {
      pasang(<Skeleton width={200} height={48} />);
      const el = wadah?.querySelector('[role="status"]');
      expect(el).not.toBeNull();
      expect(el?.textContent).toBe("Memuat");
      expect((el as HTMLElement | null)?.style.width).toBe("200px");
      expect((el as HTMLElement | null)?.style.height).toBe("48px");
    });

    it("SkeletonText: jumlah baris sesuai permintaan, baris akhir lebih pendek", () => {
      pasang(<SkeletonText lines={3} />);
      const baris = wadah?.querySelectorAll(".dh-skeleton") ?? [];
      expect(baris).toHaveLength(3);
      expect((baris[2] as HTMLElement).style.width).toBe("60%");
    });
  });
});
