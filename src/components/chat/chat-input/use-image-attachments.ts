import { useCallback, useRef, useState } from "react";
import { pluginNotice } from "../../../shared/plugin-notice";

import type { AttachedImage } from "../ImagePreviewStrip";

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_IMAGE_COUNT = 10;
const SUPPORTED_IMAGE_TYPES = [
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
] as const;
type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

interface UseImageAttachmentsParams {
	supportsImages: boolean;
	attachedImages: AttachedImage[];
	onAttachedImagesChange: (images: AttachedImage[]) => void;
}

export function useImageAttachments({
	supportsImages,
	attachedImages,
	onAttachedImagesChange,
}: UseImageAttachmentsParams) {
	const [isDraggingOver, setIsDraggingOver] = useState(false);
	const dragCounterRef = useRef(0);

	const addImage = useCallback(
		(image: AttachedImage) => {
			if (attachedImages.length >= MAX_IMAGE_COUNT) {
				return;
			}
			onAttachedImagesChange([...attachedImages, image]);
		},
		[attachedImages, onAttachedImagesChange],
	);

	const removeImage = useCallback(
		(id: string) => {
			onAttachedImagesChange(attachedImages.filter((img) => img.id !== id));
		},
		[attachedImages, onAttachedImagesChange],
	);

	const fileToBase64 = useCallback(async (file: File): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				resolve(result.split(",")[1]);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}, []);

	const processImageFiles = useCallback(
		async (files: File[]) => {
			let addedCount = 0;

			for (const file of files) {
				if (attachedImages.length + addedCount >= MAX_IMAGE_COUNT) {
					pluginNotice(`Maximum ${MAX_IMAGE_COUNT} images allowed`);
					break;
				}

				if (file.size > MAX_IMAGE_SIZE_BYTES) {
					pluginNotice(`Image too large (max ${MAX_IMAGE_SIZE_MB}MB)`);
					continue;
				}

				try {
					const base64 = await fileToBase64(file);
					addImage({
						id: crypto.randomUUID(),
						data: base64,
						mimeType: file.type,
					});
					addedCount++;
				} catch (error) {
					console.error("Failed to convert image:", error);
					pluginNotice("Failed to attach image");
				}
			}
		},
		[attachedImages.length, addImage, fileToBase64],
	);

	const handlePaste = useCallback(
		async (e: React.ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			const imageFiles: File[] = [];
			for (const item of Array.from(items)) {
				if (SUPPORTED_IMAGE_TYPES.includes(item.type as SupportedImageType)) {
					const file = item.getAsFile();
					if (file) imageFiles.push(file);
				}
			}

			if (imageFiles.length === 0) return;
			e.preventDefault();

			if (!supportsImages) {
				pluginNotice("This agent does not support image attachments");
				return;
			}

			await processImageFiles(imageFiles);
		},
		[supportsImages, processImageFiles],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		if (e.dataTransfer?.types.includes("Files")) {
			e.preventDefault();
			e.dataTransfer.dropEffect = "copy";
		}
	}, []);

	const handleDragEnter = useCallback((e: React.DragEvent) => {
		if (e.dataTransfer?.types.includes("Files")) {
			e.preventDefault();
			dragCounterRef.current++;
			if (dragCounterRef.current === 1) {
				setIsDraggingOver(true);
			}
		}
	}, []);

	const handleDragLeave = useCallback((_e: React.DragEvent) => {
		dragCounterRef.current--;
		if (dragCounterRef.current === 0) {
			setIsDraggingOver(false);
		}
	}, []);

	const handleDrop = useCallback(
		async (e: React.DragEvent) => {
			dragCounterRef.current = 0;
			setIsDraggingOver(false);

			const files = e.dataTransfer?.files;
			if (!files || files.length === 0) return;

			const imageFiles = Array.from(files).filter((file) =>
				SUPPORTED_IMAGE_TYPES.includes(file.type as SupportedImageType),
			);
			if (imageFiles.length === 0) return;

			e.preventDefault();
			if (!supportsImages) {
				pluginNotice("This agent does not support image attachments");
				return;
			}

			await processImageFiles(imageFiles);
		},
		[supportsImages, processImageFiles],
	);

	return {
		isDraggingOver,
		removeImage,
		handlePaste,
		handleDragOver,
		handleDragEnter,
		handleDragLeave,
		handleDrop,
	};
}
