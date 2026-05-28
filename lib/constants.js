export const CURRENT_USER = "@captain";

export const STORAGE_KEY = "onemoment-channel-mvp-next";

export const CHANNEL_TYPES = {
  general: {
    label: "일반 소통",
    tone: "neutral",
    description: "채팅, 게시판, 파일 공유 중심의 일반 업무 채널입니다."
  },
  purchase: {
    label: "구매요청",
    tone: "purchase",
    description: "Ideas에 구매요청을 올리면 Mac mini 구매봇이 구매 후보를 준비합니다."
  },
  inbound: {
    label: "입고",
    tone: "sheet",
    description: "입고 내용을 Ideas에 올리면 연결된 입고대장 스프레드시트에 반영합니다."
  },
  outbound: {
    label: "출고",
    tone: "sheet",
    description: "출고 내용을 Ideas에 올리면 연결된 출고대장 스프레드시트에 반영합니다."
  },
  inventory: {
    label: "재고관리",
    tone: "sheet",
    description: "재고 변동 내용을 Ideas에 올리면 재고표를 갱신합니다."
  }
};

export const TABS = [
  { id: "messages", label: "Messages" },
  { id: "ideas", label: "Ideas" },
  { id: "files", label: "Files" }
];

export const POST_STATUSES = ["검토중", "진행중", "완료"];
