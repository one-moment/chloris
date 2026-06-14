"use client";

import AutomationPanel from "../AutomationPanel";
import FilesView from "../FilesView";
import IdeasView from "../IdeasView";
import MessagesView from "../MessagesView";
import Topbar from "../Topbar";
import { useWorkspace } from "./WorkspaceShell";

export default function ChatView() {
  const {
    state,
    currentUser,
    users,
    project,
    channel,
    activeTab,
    setActiveTab,
    activeFilter,
    setActiveFilter,
    filteredPosts,
    counts,
    postStatuses,
    availableBots,
    channelInsights,
    actionError,
    requestJson,
    navigateTo,
    openSearch,
    openSidebar,
    messageAttachments,
    postAttachments,
    addMessageAttachments,
    addPostAttachments,
    removeMessageAttachment,
    removePostAttachment,
    commentDrafts,
    setCommentDraft,
    fileDraft,
    setFileDraft,
    sendMessage,
    editMessage,
    createPost,
    changePostStatus,
    editPost,
    editComment,
    addComment,
    addReply,
    togglePostPin,
    addFile,
    runBot,
    completeRun,
    approveRun,
    rejectRun,
    actOnPurchaseRequest,
    updatePurchaseOrderDraft,
    approvePurchaseOrderDraft,
    changeChannelBranch,
    templates,
    openTemplateManager
  } = useWorkspace();

  const branchName = (state.branches ?? []).find((item) => item.id === channel.branchId)?.name ?? "";
  const templateContext = { branchName, userName: currentUser?.name };

  return (
    <>
      <Topbar
        project={project}
        channel={channel}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onToggleSidebar={openSidebar}
        notifications={channelInsights.notifications}
        onNotificationClick={navigateTo}
        onOpenSearch={openSearch}
        branches={state.branches ?? []}
        currentUser={currentUser}
        onChangeBranch={changeChannelBranch}
      />

      <div className="work-surface">
        {activeTab === "messages" && (
          <MessagesView
            channel={channel}
            currentUser={currentUser}
            users={users}
            attachments={messageAttachments}
            error={actionError}
            onAttachmentsChange={addMessageAttachments}
            onRemoveAttachment={removeMessageAttachment}
            onSend={sendMessage}
            onEditMessage={editMessage}
            purchaseRequests={state.purchaseRequests ?? []}
            onPurchaseRequestAction={actOnPurchaseRequest}
            purchaseOrderDrafts={state.purchaseOrderDrafts ?? []}
            onPurchaseOrderDraftUpdate={updatePurchaseOrderDraft}
            onPurchaseOrderDraftApprove={approvePurchaseOrderDraft}
          />
        )}
        {activeTab === "ideas" && (
          <IdeasView
            channel={channel}
            posts={filteredPosts}
            currentUser={currentUser}
            users={users}
            counts={counts}
            activeFilter={activeFilter}
            postStatuses={postStatuses}
            onFilterChange={setActiveFilter}
            attachments={postAttachments}
            error={actionError}
            onAttachmentsChange={addPostAttachments}
            onRemoveAttachment={removePostAttachment}
            onCreatePost={createPost}
            commentDrafts={commentDrafts}
            onCommentDraftChange={setCommentDraft}
            onAddComment={addComment}
            onStatusChange={changePostStatus}
            onEditPost={editPost}
            onEditComment={editComment}
            onAddReply={addReply}
            onTogglePin={togglePostPin}
            templates={templates}
            templateContext={templateContext}
            onOpenTemplateManager={openTemplateManager}
          />
        )}
        {activeTab === "files" && (
          <FilesView channel={channel} draft={fileDraft} onDraftChange={setFileDraft} onAddFile={addFile} />
        )}
        <AutomationPanel
          channel={channel}
          bots={availableBots}
          currentUser={currentUser}
          users={users}
          requestJson={requestJson}
          onRunBot={runBot}
          onCompleteRun={completeRun}
          onApproveRun={approveRun}
          onRejectRun={rejectRun}
        />
      </div>
    </>
  );
}
