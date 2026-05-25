"use client";

import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { useState } from "react";

// World topojson served from /public to avoid CSP restrictions
const GEO_URL = "/world-110m.json";

// ISO numeric → ISO alpha-3 mapping for African countries
const NUMERIC_TO_ALPHA3: Record<string, string> = {
  "12": "DZA", "24": "AGO", "204": "BEN", "72": "BWA", "854": "BFA",
  "108": "BDI", "132": "CPV", "120": "CMR", "140": "CAF", "148": "TCD",
  "174": "COM", "180": "COD", "178": "COG", "384": "CIV", "262": "DJI",
  "818": "EGY", "226": "GNQ", "232": "ERI", "748": "SWZ", "231": "ETH",
  "266": "GAB", "270": "GMB", "288": "GHA", "324": "GIN", "624": "GNB",
  "404": "KEN", "426": "LSO", "430": "LBR", "434": "LBY", "450": "MDG",
  "454": "MWI", "466": "MLI", "478": "MRT", "480": "MUS", "504": "MAR",
  "508": "MOZ", "516": "NAM", "562": "NER", "566": "NGA", "646": "RWA",
  "678": "STP", "686": "SEN", "694": "SLE", "706": "SOM", "710": "ZAF",
  "728": "SSD", "729": "SDN", "834": "TZA", "768": "TGO", "788": "TUN",
  "800": "UGA", "894": "ZMB", "716": "ZWE",
};

const AFRICA_ALPHA3 = new Set(Object.values(NUMERIC_TO_ALPHA3));

// Country name lookup for tooltip
const ALPHA3_TO_NAME: Record<string, string> = {
  DZA: "Algeria", AGO: "Angola", BEN: "Benin", BWA: "Botswana",
  BFA: "Burkina Faso", BDI: "Burundi", CPV: "Cabo Verde", CMR: "Cameroon",
  CAF: "Central African Republic", TCD: "Chad", COM: "Comoros",
  COD: "DR Congo", COG: "Republic of Congo", CIV: "Côte d'Ivoire",
  DJI: "Djibouti", EGY: "Egypt", GNQ: "Equatorial Guinea", ERI: "Eritrea",
  SWZ: "Eswatini", ETH: "Ethiopia", GAB: "Gabon", GMB: "Gambia",
  GHA: "Ghana", GIN: "Guinea", GNB: "Guinea-Bissau", KEN: "Kenya",
  LSO: "Lesotho", LBR: "Liberia", LBY: "Libya", MDG: "Madagascar",
  MWI: "Malawi", MLI: "Mali", MRT: "Mauritania", MUS: "Mauritius",
  MAR: "Morocco", MOZ: "Mozambique", NAM: "Namibia", NER: "Niger",
  NGA: "Nigeria", RWA: "Rwanda", STP: "São Tomé & Príncipe",
  SEN: "Senegal", SLE: "Sierra Leone", SOM: "Somalia", ZAF: "South Africa",
  SSD: "South Sudan", SDN: "Sudan", TZA: "Tanzania", TGO: "Togo",
  TUN: "Tunisia", UGA: "Uganda", ZMB: "Zambia", ZWE: "Zimbabwe",
};

type Props = {
  // Map from ISO alpha-3 code → number of active grants in that country
  grantsByCountry: Record<string, number>;
};

export function AfricaMap({ grantsByCountry }: Props) {
  const [tooltip, setTooltip] = useState<string | null>(null);
  const maxGrants = Math.max(1, ...Object.values(grantsByCountry));

  function getFill(alpha3: string) {
    const count = grantsByCountry[alpha3] ?? 0;
    if (count === 0) return "#e8ede4";           // no grants — light green-grey
    const intensity = count / maxGrants;
    if (intensity >= 0.8) return "#3d5a1e";      // deep green
    if (intensity >= 0.5) return "#5a7d2f";
    if (intensity >= 0.3) return "#7aab40";
    if (intensity >= 0.1) return "#a3c96a";
    return "#c8e09d";                             // lightest active
  }

  return (
    <div className="relative w-full">
      {tooltip && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 pointer-events-none shadow-lg">
          {tooltip}
        </div>
      )}

      <ComposableMap
        projection="geoAzimuthalEqualArea"
        projectionConfig={{ rotate: [-25, -5, 0], scale: 370 }}
        width={560}
        height={620}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies
                .filter((geo) => {
                  const alpha3 = NUMERIC_TO_ALPHA3[geo.id];
                  return alpha3 && AFRICA_ALPHA3.has(alpha3);
                })
                .map((geo) => {
                  const alpha3 = NUMERIC_TO_ALPHA3[geo.id]!;
                  const count  = grantsByCountry[alpha3] ?? 0;
                  const name   = ALPHA3_TO_NAME[alpha3] ?? alpha3;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getFill(alpha3)}
                      stroke="#fff"
                      strokeWidth={0.5}
                      onMouseEnter={() =>
                        setTooltip(
                          count > 0
                            ? `${name} · ${count} active grant${count !== 1 ? "s" : ""}`
                            : name
                        )
                      }
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        default: { outline: "none", cursor: count > 0 ? "pointer" : "default" },
                        hover:   { outline: "none", fill: count > 0 ? "#2a4010" : "#d4dfd0" },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-2 justify-center">
        <span className="text-xs text-gray-500">No grants</span>
        <div className="flex gap-0.5">
          {["#c8e09d", "#a3c96a", "#7aab40", "#5a7d2f", "#3d5a1e"].map((c) => (
            <div key={c} className="w-5 h-3 rounded-sm" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span className="text-xs text-gray-500">Most active</span>
      </div>
    </div>
  );
}
