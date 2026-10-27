import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CarouselApi = UseEmblaCarouselType[1];
type CarouselProps = ComponentProps<"div"> & { opts?: Parameters<typeof useEmblaCarousel>[0]; setApi?: (api: CarouselApi) => void };
function Carousel({ className, children, opts, setApi, ...props }: CarouselProps) {
	const [viewportRef, api] = useEmblaCarousel({ loop: false, ...opts });
	useEffect(() => { if (api) setApi?.(api); }, [api, setApi]);
	return <div className={cn("relative", className)} {...props}><div className="overflow-hidden" ref={viewportRef}><div className="flex touch-pan-y">{children}</div></div></div>;
}
function CarouselItem({ className, ...props }: ComponentProps<"div">) { return <div className={cn("min-w-0 flex-[0_0_100%]", className)} {...props} />; }
function CarouselPrevious({ className, ...props }: ComponentProps<typeof Button>) { return <Button aria-label="Previous image" className={cn("absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full", className)} size="icon" variant="secondary" {...props}><ArrowLeftIcon /></Button>; }
function CarouselNext({ className, ...props }: ComponentProps<typeof Button>) { return <Button aria-label="Next image" className={cn("absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full", className)} size="icon" variant="secondary" {...props}><ArrowRightIcon /></Button>; }

function useCarouselNavigation(api: CarouselApi | null) {
	const [canScrollPrevious, setCanScrollPrevious] = useState(false);
	const [canScrollNext, setCanScrollNext] = useState(false);
	const update = useCallback(() => { if (!api) return; setCanScrollPrevious(api.canScrollPrev()); setCanScrollNext(api.canScrollNext()); }, [api]);
	useEffect(() => { if (!api) return; update(); api.on("select", update); api.on("reInit", update); return () => { api.off("select", update); api.off("reInit", update); }; }, [api, update]);
	return { canScrollPrevious, canScrollNext, previous: () => api?.scrollPrev(), next: () => api?.scrollNext() };
}
export { Carousel, CarouselItem, CarouselPrevious, CarouselNext, useCarouselNavigation };
