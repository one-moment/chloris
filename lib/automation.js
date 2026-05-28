const SHEET_TARGETS = {
  inbound: "입고대장",
  outbound: "출고대장",
  inventory: "재고표"
};

export function buildAutomationPayload({ project, channel, bot, requester = "@captain" }) {
  const openPosts = channel.posts.filter((post) => post.status !== "완료");
  const base = {
    requestId: `run-${Date.now()}`,
    requester,
    project: { id: project.id, name: project.name },
    channel: { id: channel.id, name: channel.name, type: channel.type },
    bot: { id: bot.id, name: bot.name, provider: bot.provider, command: bot.command },
    openPosts: openPosts.map((post) => ({
      id: post.id,
      title: post.title,
      body: post.body,
      author: post.author,
      status: post.status,
      comments: post.comments ?? []
    }))
  };

  if (channel.type === "purchase") {
    return {
      ...base,
      approvalRequired: true,
      buyerBotHost: "mac-mini-purchase-bot",
      vendorTargets: ["coupang", "gmarket"],
      browserAutomation: {
        mode: "remote_browser_control",
        allowedUntil: "checkout_review",
        stopBeforePayment: true,
        finalPaymentMode: "human_approval_required"
      }
    };
  }

  if (SHEET_TARGETS[channel.type]) {
    return {
      ...base,
      approvalRequired: false,
      sheetSync: {
        target: SHEET_TARGETS[channel.type],
        mode: "append_or_update",
        source: "ideas"
      }
    };
  }

  return {
    ...base,
    approvalRequired: false,
    summaryMode: "channel_handoff"
  };
}

export function makeBotRun({ bot, channel, payload }) {
  return {
    id: payload.requestId,
    botId: bot.id,
    botName: bot.name,
    status: "실행중",
    createdAt: "방금 전",
    summary: `${channel.name} 채널의 열린 Ideas ${payload.openPosts.length}건을 처리합니다.`,
    payload,
    approvalStatus: payload.approvalRequired ? "준비중" : "불필요"
  };
}

export function completeBotRun(run, channelType) {
  if (channelType === "purchase") {
    return {
      ...run,
      status: "승인 대기",
      approvalStatus: "승인 대기",
      summary: "구매 후보를 장바구니/결제 검토 단계까지 준비했습니다. 실제 결제는 담당자 승인 후 진행됩니다."
    };
  }

  if (run.payload.sheetSync) {
    return {
      ...run,
      status: "성공",
      summary: `${run.payload.sheetSync.target} 스프레드시트에 Ideas 내용을 반영했습니다.`
    };
  }

  return {
    ...run,
    status: "성공",
    summary: "채널 대화와 Ideas를 요약했습니다."
  };
}
