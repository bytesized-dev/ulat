import { afterEach, describe, expect, it } from "vitest";
import { clearReportPhoto, getPhotoSnapshot, loadReportPhoto, memoryPhotoStore, keepReportPhoto } from "./report-photo-store";
import { clearDraft } from "./report-draft";

afterEach(() => clearReportPhoto());

const jpeg = (text: string) => new Blob([text], { type: "image/jpeg" });

describe("memory photo store", () => {
  it("keeps one photo, and a new one replaces it", async () => {
    const store = memoryPhotoStore();
    expect(await store.get()).toBeNull();
    const first = jpeg("a");
    const second = jpeg("b");
    await store.set(first);
    await store.set(second);
    expect(await store.get()).toBe(second);
    await store.clear();
    expect(await store.get()).toBeNull();
  });
});

describe("report photo", () => {
  it("is empty and ready after the first read finds nothing", async () => {
    await loadReportPhoto();
    expect(getPhotoSnapshot()).toEqual({ photo: null, ready: true });
  });

  it("shows a photo as soon as it is set", async () => {
    const photo = jpeg("a");
    await keepReportPhoto(photo);
    expect(getPhotoSnapshot()).toEqual({ photo, ready: true });
  });

  it("is cleared with the draft", async () => {
    await keepReportPhoto(jpeg("a"));
    clearDraft(null);
    expect(getPhotoSnapshot().photo).toBeNull();
  });
});
