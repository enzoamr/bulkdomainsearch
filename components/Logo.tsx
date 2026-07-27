/**
 * The mark: a rounded tile in the accent color with a white bolt. The tile
 * reads its color from the accent token, so it re-skins with the random hue
 * on every load like the rest of the site.
 */
export default function Logo({ className = "size-6" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-md bg-accent ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="#fff"
        className="h-[62%] w-[62%]"
        aria-hidden="true"
      >
        <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
      </svg>
    </span>
  );
}
