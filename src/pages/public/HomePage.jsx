import React from "react";
import HomeMotion from "../home/HomeMotion.jsx";
import { useLanguage } from "../../i18n/useLanguage.js";

export function HomeScreen({ navigate }) {
  useLanguage();
  return <HomeMotion navigate={navigate} />;
}
