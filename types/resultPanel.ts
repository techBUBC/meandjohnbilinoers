export type ResultPanelItem = {
  primary: string;
  secondary?: string;
  meta?: string;
};

export type ResultPanelSection = {
  title: string;
  items: ResultPanelItem[];
};

export type ResultPanelData = {
  heading: string;
  subtitle?: string;
  sections: ResultPanelSection[];
};
