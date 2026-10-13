import React, { useId } from "react";

// The client sprite contains two 52 × 56 states; use the first as an alpha mask.
export function MinionIcon(props) {
  const maskId = `minion-${useId()}`;
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 52 56" fill="currentColor" focusable="false" {...props}>
    <defs>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="52" height="56" maskType="alpha">
        <image href="/assets/stats/minions.png" width="52" height="112" />
      </mask>
    </defs>
    <rect width="52" height="56" mask={`url(#${maskId})`} />
  </svg>;
}
