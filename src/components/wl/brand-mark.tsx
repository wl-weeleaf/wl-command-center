import { LeafyWidget } from "@/components/wl/leafy-widget";

export function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    <img
      src="/emblem.svg"
      alt=""
      className={className}
      width={36}
      height={36}
    />
  );
}

export function LeafyAvatar({ size = 56 }: { size?: number }) {
  return <LeafyWidget size={size} />;
}
