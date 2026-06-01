import { requireCurrentUser } from "../../../../lib/auth";
import { badRequest } from "../../../../lib/serverState";
import { createUploadTarget } from "../../../../lib/storage";

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { fileName, fileType, fileSize } = await request.json();
  if (!fileName) return badRequest("File name is required.");

  try {
    return Response.json(await createUploadTarget({
      fileName,
      fileType,
      fileSize,
      userId: user.id
    }));
  } catch (error) {
    return badRequest(error.message);
  }
}
