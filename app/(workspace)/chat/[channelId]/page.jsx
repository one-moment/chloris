"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import ChatView from "../../../../components/workspace/ChatView";
import { useWorkspace } from "../../../../components/workspace/WorkspaceShell";

export default function ChatChannelPage() {
  const params = useParams();
  const channelId = typeof params?.channelId === "string" ? params.channelId : null;
  const { stateLoaded, applyChannelFromUrl } = useWorkspace();

  useEffect(() => {
    if (stateLoaded && channelId) applyChannelFromUrl(channelId);
  }, [channelId, stateLoaded, applyChannelFromUrl]);

  return <ChatView />;
}
