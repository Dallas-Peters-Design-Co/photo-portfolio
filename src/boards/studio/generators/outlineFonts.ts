// Font files for type drawn as vector outlines (vectorType.ts): each face's
// Latin WOFF from its @fontsource package, by weight.

import anton400 from "@fontsource/anton/files/anton-latin-400-normal.woff?url";
import archivo400 from "@fontsource/archivo/files/archivo-latin-400-normal.woff?url";
import archivo700 from "@fontsource/archivo/files/archivo-latin-700-normal.woff?url";
import archivo800 from "@fontsource/archivo/files/archivo-latin-800-normal.woff?url";
import archivo900 from "@fontsource/archivo/files/archivo-latin-900-normal.woff?url";
import archivoBlack400 from "@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff?url";
import bebasNeue400 from "@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff?url";
import dmSans400 from "@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff?url";
import dmSans700 from "@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff?url";
import dmSans800 from "@fontsource/dm-sans/files/dm-sans-latin-800-normal.woff?url";
import dmSans900 from "@fontsource/dm-sans/files/dm-sans-latin-900-normal.woff?url";
import inter400 from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import inter700 from "@fontsource/inter/files/inter-latin-700-normal.woff?url";
import inter800 from "@fontsource/inter/files/inter-latin-800-normal.woff?url";
import inter900 from "@fontsource/inter/files/inter-latin-900-normal.woff?url";
import leagueGothic400 from "@fontsource/league-gothic/files/league-gothic-latin-400-normal.woff?url";
import oswald400 from "@fontsource/oswald/files/oswald-latin-400-normal.woff?url";
import oswald700 from "@fontsource/oswald/files/oswald-latin-700-normal.woff?url";
import spaceGrotesk400 from "@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff?url";
import spaceGrotesk700 from "@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff?url";
import syne400 from "@fontsource/syne/files/syne-latin-400-normal.woff?url";
import syne700 from "@fontsource/syne/files/syne-latin-700-normal.woff?url";
import syne800 from "@fontsource/syne/files/syne-latin-800-normal.woff?url";
import unbounded400 from "@fontsource/unbounded/files/unbounded-latin-400-normal.woff?url";
import unbounded700 from "@fontsource/unbounded/files/unbounded-latin-700-normal.woff?url";
import unbounded800 from "@fontsource/unbounded/files/unbounded-latin-800-normal.woff?url";
import unbounded900 from "@fontsource/unbounded/files/unbounded-latin-900-normal.woff?url";

/** Each family's files by weight, for the faces outline type can use. */
export const OUTLINE_FONTS: Record<string, Record<number, string>> = {
  Anton: { 400: anton400 },
  Archivo: {
    400: archivo400,
    700: archivo700,
    800: archivo800,
    900: archivo900,
  },
  "Archivo Black": { 400: archivoBlack400 },
  "Bebas Neue": { 400: bebasNeue400 },
  "DM Sans": { 400: dmSans400, 700: dmSans700, 800: dmSans800, 900: dmSans900 },
  Inter: { 400: inter400, 700: inter700, 800: inter800, 900: inter900 },
  "League Gothic": { 400: leagueGothic400 },
  Oswald: { 400: oswald400, 700: oswald700 },
  "Space Grotesk": { 400: spaceGrotesk400, 700: spaceGrotesk700 },
  Syne: { 400: syne400, 700: syne700, 800: syne800 },
  Unbounded: {
    400: unbounded400,
    700: unbounded700,
    800: unbounded800,
    900: unbounded900,
  },
};
