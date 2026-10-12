"use client";

/* eslint-disable @next/next/no-img-element -- local object URLs and API-hosted logos */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, OrgAvatar } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { qk } from "@/lib/queries";
import type { Org } from "@/lib/types";

const MAX = 1_000_000;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Drag-and-drop logo upload with preview. PNG, JPG or WebP up to 1 MB. */
export function LogoUpload({ org, onUploaded, compact = false }: { org: Org; onUploaded?: (o: Org) => void; compact?: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const setPicked = (f: File | null) => {
    // the previous URL is revoked by the effect cleanup below
    setPreview(f ? URL.createObjectURL(f) : null);
    setFile(f);
  };
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const upload = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData();
      fd.append("file", f);
      return api<Org>("/orgs/me/logo", { method: "POST", form: fd });
    },
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: qk.me });
      setPicked(null);
      onUploaded?.(o);
    },
  });

  const choose = (f: File | undefined | null) => {
    if (!f) return;
    if (!TYPES.includes(f.type)) return setProblem("Use a PNG, JPG or WebP image.");
    if (f.size > MAX) return setProblem("That file is over 1 MB. Try a smaller image.");
    setProblem(null);
    setPicked(f);
  };

  return (
    <div className={cn("flex gap-6", compact ? "items-center" : "flex-col items-stretch sm:flex-row sm:items-center")}>
      <div className="relative">
        {preview ? (
          <img src={preview} alt="New logo preview" className="size-24 rounded-[30%] border border-line-strong object-cover" />
        ) : (
          <OrgAvatar name={org.name} src={org.logo_url} kind={org.kind} size={96} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            choose(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed px-4 py-6 text-center transition",
            drag ? "border-horizon-2 bg-horizon-1/10" : "border-line-strong hover:border-white/30 hover:bg-white/[0.02]",
          )}
        >
          <ImagePlus className="size-5 text-ink-2" />
          <span className="text-[14px] text-ink">{file ? file.name : "Drop a logo here, or click to choose"}</span>
          <span className="text-[12.5px] text-ink-3">PNG, JPG or WebP, up to 1 MB. Square works best.</span>
        </button>
        <input
          ref={input}
          type="file"
          accept={TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a logo file"
          onChange={(e) => choose(e.target.files?.[0])}
        />
        {(problem || upload.error) && <p className="mt-2 text-[13px] text-loss-text">{problem ?? errorMessage(upload.error)}</p>}
        {file && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="white" icon={<Upload className="size-3.5" />} busy={upload.isPending} onClick={() => upload.mutate(file)}>
              Upload logo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
