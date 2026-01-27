import type { TurnoverEvent } from './types';

// Based on FIH Field Specifications
const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;
const LANE_WIDTH = PITCH_WIDTH / 3;

/**
 * Parses SportsCode XML data to extract turnover events.
 * @param xmlText The XML content as a string.
 * @param homeTeamName The name of the home team.
 * @param awayTeamName The name of the away team.
 * @returns An array of TurnoverEvent objects.
 */
export const parseXMLData = (xmlText: string, homeTeamName: string, awayTeamName: string): TurnoverEvent[] => {
  if (typeof window === 'undefined') {
    // This function should only run in the browser
    return [];
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  
  const parseError = xmlDoc.querySelector("parsererror");
  if (parseError) {
    console.error("XML Parsing Error:", parseError);
    throw new Error("Failed to parse XML. Please check the file format.");
  }
  
  const instances = xmlDoc.getElementsByTagName("instance");
  const events: TurnoverEvent[] = [];

  Array.from(instances).forEach((instance, index) => {
    const code = instance.getElementsByTagName("code")[0]?.textContent || "";
    
    // 1. Filter for turnover events only
    if (!code.toLowerCase().includes("turnover") && !code.includes("턴오버")) return;

    // 2. Identify the team
    // This is a simplified logic. A real implementation might need to check group labels.
    const team = code.toLowerCase().includes(homeTeamName.toLowerCase()) ? homeTeamName : awayTeamName;

    // 3. Parse location labels
    const labels = instance.getElementsByTagName("label");
    let locLabel = "";
    for (let i = 0; i < labels.length; i++) {
      const group = labels[i].getElementsByTagName("group")[0]?.textContent;
      const text = labels[i].getElementsByTagName("text")[0]?.textContent;
      if (group === "지역" || group === "Location") {
        locLabel = text || "";
        break;
      }
    }
    
    // If no specific location label, skip
    if (!locLabel) return;

    // 4. Map Zone Label to X, Y Coordinates
    // Attacking direction is assumed to be Left (0) -> Right (91.4)
    let x = PITCH_LENGTH / 2;
    let y = PITCH_WIDTH / 2;

    // X-axis (Length) mapping
    if (locLabel.includes("Def 25") || locLabel.includes("수비 25")) x = PITCH_LENGTH * 0.125;
    else if (locLabel.includes("Mid") || locLabel.includes("하프")) x = PITCH_LENGTH * 0.5;
    else if (locLabel.includes("Att 25") || locLabel.includes("공격 25")) x = PITCH_LENGTH * 0.875;
    else if (locLabel.includes("Circle") || locLabel.includes("서클")) x = PITCH_LENGTH * 0.95;

    // Y-axis (Width) mapping (Top-down view: Left is top, Right is bottom)
    if (locLabel.includes("Left") || locLabel.includes("좌")) y = LANE_WIDTH / 2;
    else if (locLabel.includes("Right") || locLabel.includes("우")) y = PITCH_WIDTH - (LANE_WIDTH / 2);
    else y = PITCH_WIDTH / 2; // Center

    // Add random jitter to avoid points overlapping perfectly
    x += (Math.random() - 0.5) * 8;
    y += (Math.random() - 0.5) * 8;

    // Ensure coordinates are within pitch boundaries
    x = Math.max(0, Math.min(PITCH_LENGTH, x));
    y = Math.max(0, Math.min(PITCH_WIDTH, y));
    
    events.push({
      id: `evt-${instance.getElementsByTagName("ID")[0]?.textContent || index}`,
      team,
      quarter: "Q1", // This would need to be calculated from XML start time
      time: parseFloat(instance.getElementsByTagName("start")[0]?.textContent || "0"),
      x,
      y,
      locationLabel: locLabel
    });
  });

  return events;
};

    