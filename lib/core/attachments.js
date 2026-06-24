// 첨부 업로드 공유 헬퍼: 압축 → presign → (S3 PUT | inline dataURL).
// 채팅(WorkspaceShell)·폐기(DisposalDashboard) 등에서 동일 경로/동일 저장형태를 공유한다.
// 저장 형태: s3   = { id, name, type, size, storage:"s3", key, url }
//            inline = { id, name, type, size, storage:"inline", dataUrl }
import { maybeCompressImage } from "../imageCompress";
import { requestJson } from "./apiClient";

export const MAX_INLINE_ATTACHMENT_SIZE = 1_500_000;

function attachmentId() {
  return `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function filesToAttachments(fileList) {
  const files = Array.from(fileList ?? []);
  const uploaded = [];

  for (const rawFile of files) {
    const file = await maybeCompressImage(rawFile);
    const target = await requestJson("/api/uploads/presign", {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size
      })
    });

    if (target.provider === "s3") {
      await fetch(target.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream"
        },
        body: file
      });
      uploaded.push({
        id: attachmentId(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        storage: "s3",
        key: target.key,
        url: target.publicUrl
      });
      continue;
    }

    if (file.size > MAX_INLINE_ATTACHMENT_SIZE) {
      window.alert("이 파일은 1.5MB가 넘어 첨부할 수 없습니다. 사진은 자동 압축되며, 큰 파일은 운영(S3) 설정에서 업로드하세요.");
      continue;
    }

    uploaded.push(await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: attachmentId(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        storage: "inline",
        dataUrl: reader.result
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }));
  }

  return uploaded;
}
