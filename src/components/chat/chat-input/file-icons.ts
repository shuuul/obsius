const EXTENSION_ICON_MAP: Record<string, string> = {
	md: "file-text",
	txt: "file-text",
	pdf: "file-type",
	png: "image",
	jpg: "image",
	jpeg: "image",
	gif: "image",
	webp: "image",
	svg: "image",
	bmp: "image",
	mp3: "music",
	wav: "music",
	ogg: "music",
	flac: "music",
	mp4: "video",
	webm: "video",
	mov: "video",
	js: "file-code",
	ts: "file-code",
	jsx: "file-code",
	tsx: "file-code",
	py: "file-code",
	java: "file-code",
	c: "file-code",
	cpp: "file-code",
	rs: "file-code",
	go: "file-code",
	rb: "file-code",
	json: "braces",
	yaml: "braces",
	yml: "braces",
	toml: "braces",
	css: "palette",
	scss: "palette",
	less: "palette",
	html: "globe",
	xml: "globe",
	csv: "table",
	xls: "table",
	xlsx: "table",
	canvas: "layout-dashboard",
	excalidraw: "pencil-ruler",
};

/**
 * Get the Lucide icon name for a file based on its name/extension.
 * Defaults to "file-text" for Obsidian notes (no extension = markdown).
 */
export function getFileIcon(filename: string): string {
	const dotIndex = filename.lastIndexOf(".");
	if (dotIndex === -1) return "file-text";
	const ext = filename.slice(dotIndex + 1).toLowerCase();
	return EXTENSION_ICON_MAP[ext] ?? "file";
}
