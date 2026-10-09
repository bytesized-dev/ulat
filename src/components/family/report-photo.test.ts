import { describe, expect, it } from "vitest";
import { fitWithin, keepableType, PHOTO_MAX_BYTES, PHOTO_MAX_SIDE, preparePhoto } from "./report-photo";

function file(name: string, type: string, size = 100): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("fitWithin", () => {
  it("shrinks the long side to the limit and keeps the shape", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it("never enlarges a small photo", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(PHOTO_MAX_SIDE, 10)).toEqual({ width: PHOTO_MAX_SIDE, height: 10 });
  });

  it("keeps at least one pixel on a very thin photo", () => {
    expect(fitWithin(16000, 1)).toEqual({ width: 1600, height: 1 });
  });
});

describe("keepableType", () => {
  it("takes the types the hub accepts", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
      expect(keepableType({ type, name: "x" })).toBe(type);
    }
  });

  it("reads the type from the extension when the phone left it empty", () => {
    expect(keepableType({ type: "", name: "IMG_0042.HEIC" })).toBe("image/heic");
    expect(keepableType({ type: "application/octet-stream", name: "a.jpg" })).toBe("image/jpeg");
  });

  it("refuses a type the hub would refuse", () => {
    expect(keepableType({ type: "image/gif", name: "a.gif" })).toBeNull();
    expect(keepableType({ type: "", name: "notes.txt" })).toBeNull();
    expect(keepableType({ type: "", name: "noextension" })).toBeNull();
  });
});

describe("preparePhoto", () => {
  it("keeps the shrunk JPEG", async () => {
    const jpeg = new Blob(["small"], { type: "image/jpeg" });
    const seen: number[] = [];
    const result = await preparePhoto(file("a.png", "image/png", 5000), async (_file, max) => {
      seen.push(max);
      return jpeg;
    });
    expect(result).toEqual({ ok: true, photo: jpeg });
    expect(seen).toEqual([1600]);
  });

  it("keeps the original when the browser cannot decode it and it is under 10 MB", async () => {
    const heic = file("a.heic", "image/heic", 3_000_000);
    const result = await preparePhoto(heic, () => Promise.reject(new Error("decode")));
    expect(result).toEqual({ ok: true, photo: heic });
  });

  it("gives an undecoded photo with no type the type from its name", async () => {
    const result = await preparePhoto(file("IMG_1.heic", ""), () => Promise.reject(new Error("decode")));
    expect(result.ok && result.photo.type).toBe("image/heic");
  });

  it("shows an error when it cannot be decoded and is over 10 MB", async () => {
    const big = file("a.heic", "image/heic", PHOTO_MAX_BYTES + 1);
    expect(await preparePhoto(big, () => Promise.reject(new Error("decode")))).toEqual({ ok: false, error: "too_big" });
  });

  it("shows an error when it cannot be decoded and the hub would refuse its type", async () => {
    const gif = file("a.gif", "image/gif");
    expect(await preparePhoto(gif, () => Promise.reject(new Error("decode")))).toEqual({ ok: false, error: "unsupported" });
  });

  it("keeps an original of exactly 10 MB", async () => {
    const exact = file("a.heic", "image/heic", PHOTO_MAX_BYTES);
    expect((await preparePhoto(exact, () => Promise.reject(new Error("decode")))).ok).toBe(true);
  });
});
