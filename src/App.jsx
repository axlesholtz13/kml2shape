import React, { useCallback, useMemo, useRef, useState } from "react";
import { UploadCloud, FileArchive, CheckCircle2, AlertCircle, Download, Trash2, MapPinned } from "lucide-react";
import JSZip from "jszip";
import { kml as kmlToGeoJSON } from "@tmcw/togeojson";
import * as shpwrite from "shp-write";

function safeBaseName(name) {
  return (
    name
      .replace(/\.(kml|kmz)$/i, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "converted_layer"
  );
}

function countGeometryTypes(features) {
  return features.reduce((acc, f) => {
    const type = f?.geometry?.type || "No geometry";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
}

async function extractKmlText(file) {
  if (/\.kml$/i.test(file.name)) return file.text();
  if (!/\.kmz$/i.test(file.name)) throw new Error("Only .kml and .kmz files are supported.");

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const kmlEntries = Object.values(zip.files).filter((entry) => !entry.dir && /\.kml$/i.test(entry.name));
  if (!kmlEntries.length) throw new Error("No KML document was found inside this KMZ.");
  const preferred = kmlEntries.find((entry) => /(^|\/)doc\.kml$/i.test(entry.name)) || kmlEntries[0];
  return preferred.async("string");
}

function normalizeZipOutput(output) {
  if (output instanceof Blob) return output;
  if (output instanceof ArrayBuffer) return new Blob([output], { type: "application/zip" });
  if (ArrayBuffer.isView(output)) return new Blob([output], { type: "application/zip" });
  if (typeof output === "string") {
    const clean = output.includes(",") ? output.split(",").pop() : output;
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: "application/zip" });
  }
  throw new Error("The shapefile library returned an unsupported ZIP format.");
}

export default function App() {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [jobs, setJobs] = useState([]);

  const processFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => /\.(kml|kmz)$/i.test(file.name));
    if (!files.length) {
      setJobs((current) => [
        { id: crypto.randomUUID(), name: "Unsupported selection", status: "error", message: "Choose one or more KML or KMZ files." },
        ...current,
      ]);
      return;
    }

    for (const file of files) {
      const id = crypto.randomUUID();
      setJobs((current) => [{ id, name: file.name, size: file.size, status: "working", message: "Reading spatial features…" }, ...current]);
      try {
        const kmlText = await extractKmlText(file);
        const xml = new DOMParser().parseFromString(kmlText, "text/xml");
        if (xml.querySelector("parsererror")) throw new Error("The KML XML could not be parsed.");

        const geojson = kmlToGeoJSON(xml);
        const validFeatures = (geojson.features || []).filter((feature) => feature?.geometry);
        if (!validFeatures.length) throw new Error("No convertible point, line, or polygon features were found.");

        const cleanedGeoJSON = { type: "FeatureCollection", features: validFeatures };
        const base = safeBaseName(file.name);
        const zipResult = shpwrite.zip(cleanedGeoJSON, {
          folder: base,
          types: {
            point: `${base}_points`,
            polygon: `${base}_polygons`,
            line: `${base}_lines`,
          },
        });
        const blob = normalizeZipOutput(zipResult);
        const url = URL.createObjectURL(blob);
        const geometryCounts = countGeometryTypes(validFeatures);

        setJobs((current) =>
          current.map((job) =>
            job.id === id
              ? {
                  ...job,
                  status: "done",
                  message: `${validFeatures.length.toLocaleString()} feature${validFeatures.length === 1 ? "" : "s"} converted`,
                  geometryCounts,
                  url,
                  outputName: `${base}_shapefile.zip`,
                }
              : job
          )
        );
      } catch (error) {
        setJobs((current) =>
          current.map((job) => (job.id === id ? { ...job, status: "error", message: error.message || "Conversion failed." } : job))
        );
      }
    }
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragging(false);
      processFiles(event.dataTransfer.files);
    },
    [processFiles]
  );

  const clearAll = () => {
    jobs.forEach((job) => job.url && URL.revokeObjectURL(job.url));
    setJobs([]);
  };

  const completed = useMemo(() => jobs.filter((j) => j.status === "done").length, [jobs]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
              <MapPinned className="h-4 w-4" /> Browser GIS utility
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">KML/KMZ to Shapefile</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Drop Google Earth files below and download a zipped shapefile. Processing stays in your browser.
            </p>
          </div>
          {jobs.length > 0 && (
            <button
              onClick={clearAll}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Clear list
            </button>
          )}
        </header>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              e.preventDefault();
              if (e.currentTarget === e.target) setDragging(false);
            }}
            onDrop={onDrop}
            className={`flex min-h-72 w-full cursor-pointer flex-col items-center justify-center border-2 border-dashed p-8 text-center transition ${
              dragging ? "border-emerald-500 bg-emerald-50" : "border-transparent bg-white hover:bg-slate-50"
            }`}
          >
            <span className={`mb-5 rounded-2xl p-4 ${dragging ? "bg-emerald-200 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
              <UploadCloud className="h-10 w-10" />
            </span>
            <span className="text-xl font-semibold">Drop KML or KMZ files here</span>
            <span className="mt-2 text-sm text-slate-500">or click to browse • multiple files supported</span>
            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
              multiple
              onChange={(e) => processFiles(e.target.files)}
            />
          </button>
        </div>

        {jobs.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Conversions</h2>
              <span className="text-sm text-slate-500">{completed} ready</span>
            </div>
            <div className="grid gap-3">
              {jobs.map((job) => (
                <div key={job.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <div
                      className={`rounded-xl p-3 ${
                        job.status === "done"
                          ? "bg-emerald-100 text-emerald-700"
                          : job.status === "error"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {job.status === "done" ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : job.status === "error" ? (
                        <AlertCircle className="h-6 w-6" />
                      ) : (
                        <FileArchive className="h-6 w-6 animate-pulse" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{job.name}</p>
                      <p className={`mt-1 text-sm ${job.status === "error" ? "text-red-700" : "text-slate-500"}`}>{job.message}</p>
                      {job.geometryCounts && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(job.geometryCounts).map(([type, count]) => (
                            <span key={type} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                              {type}: {count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {job.status === "done" && (
                      <a
                        href={job.url}
                        download={job.outputName}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                      >
                        <Download className="mr-2 h-4 w-4" /> Download ZIP
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-8 rounded-2xl bg-slate-900 p-5 text-sm leading-6 text-slate-300">
          <p className="font-semibold text-white">Output notes</p>
          <p className="mt-1">
            The download is a ZIP containing standard shapefile components. Mixed geometry inputs are separated into point, line, and
            polygon layers. KML coordinates are geographic longitude/latitude; define or verify the output coordinate system in ArcGIS
            Pro before analysis.
          </p>
        </footer>
      </div>
    </main>
  );
}
