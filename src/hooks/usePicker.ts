import { useState, useCallback, useRef, useEffect } from "react";
import type {
	PickerItem,
	PickerPreview,
	PickerProvider,
} from "../components/picker/types";

export interface UsePickerReturn {
	isOpen: boolean;
	query: string;
	items: PickerItem[];
	selectedIndex: number;
	preview: PickerPreview | null;
	open: (initialQuery?: string) => void;
	close: () => void;
	setQuery: (query: string) => void;
	navigate: (direction: "up" | "down") => void;
	selectCurrent: () => void;
	selectAt: (index: number) => void;
	setSelectedIndex: (index: number) => void;
}

export function usePicker(providers: PickerProvider[]): UsePickerReturn {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQueryState] = useState("");
	const [items, setItems] = useState<PickerItem[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [preview, setPreview] = useState<PickerPreview | null>(null);

	const providersRef = useRef(providers);
	providersRef.current = providers;

	const searchIdRef = useRef(0);

	const runSearch = useCallback(async (q: string) => {
		const id = ++searchIdRef.current;
		const allItems: PickerItem[] = [];

		for (const provider of providersRef.current) {
			const result = await provider.search(q);
			if (searchIdRef.current !== id) return;
			allItems.push(...result);
		}

		setItems(allItems);
		setSelectedIndex(0);
		setPreview(null);
	}, []);

	const setQuery = useCallback(
		(q: string) => {
			setQueryState(q);
			void runSearch(q);
		},
		[runSearch],
	);

	const open = useCallback(
		(initialQuery = "") => {
			setIsOpen(true);
			setQueryState(initialQuery);
			void runSearch(initialQuery);
		},
		[runSearch],
	);

	const close = useCallback(() => {
		setIsOpen(false);
		setQueryState("");
		setItems([]);
		setSelectedIndex(0);
		setPreview(null);
		searchIdRef.current++;
	}, []);

	const navigate = useCallback(
		(direction: "up" | "down") => {
			setSelectedIndex((prev) => {
				const max = items.length - 1;
				if (max < 0) return 0;
				if (direction === "down") return Math.min(prev + 1, max);
				return Math.max(prev - 1, 0);
			});
		},
		[items.length],
	);

	const applyItem = useCallback(
		(item: PickerItem) => {
			for (const provider of providersRef.current) {
				if (provider.category === item.category) {
					provider.apply(item);
					break;
				}
			}
			close();
		},
		[close],
	);

	const selectCurrent = useCallback(() => {
		const item = items[selectedIndex];
		if (!item) return;
		applyItem(item);
	}, [items, selectedIndex, applyItem]);

	const selectAt = useCallback(
		(index: number) => {
			const item = items[index];
			if (!item) return;
			applyItem(item);
		},
		[items, applyItem],
	);

	useEffect(() => {
		if (!isOpen || items.length === 0) {
			setPreview(null);
			return;
		}

		const item = items[selectedIndex];
		if (!item) return;

		let cancelled = false;

		const fetchPreview = async () => {
			for (const provider of providersRef.current) {
				if (provider.category === item.category && provider.getPreview) {
					const result = provider.getPreview(item);
					const p =
						result instanceof Promise ? await result : result;
					if (!cancelled) setPreview(p);
					return;
				}
			}
			if (!cancelled) setPreview(null);
		};

		void fetchPreview();
		return () => {
			cancelled = true;
		};
	}, [isOpen, items, selectedIndex]);

	return {
		isOpen,
		query,
		items,
		selectedIndex,
		preview,
		open,
		close,
		setQuery,
		navigate,
		selectCurrent,
		selectAt,
		setSelectedIndex,
	};
}
