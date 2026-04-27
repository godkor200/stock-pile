export interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

export interface NaverNewsResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverNewsItem[];
}
