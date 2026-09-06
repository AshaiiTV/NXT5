

function roleLabel(role) {
  return {
    TOP: "Top",
    JGL: "Jungle",
    MID: "Mid",
    ADC: "ADC",
    SUP: "Support",
    SUB: "Remplaçant",
    COACH: "Coach",
    ASSISTANT: "Assistant coach",
    ANALYST: "Analyste",
    MANAGER: "Manager",
    BOARD: "Board",
    OWNER: "Owner",
    CAPTAIN: "Capitaine",
    STAFF: "Staff",
  }[String(role || "").toUpperCase()] || String(role || "Profil");
}

export { roleLabel };
