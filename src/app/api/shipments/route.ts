import { NextResponse } from "next/server";
import { apiUser, errorResponse, sameOrigin } from "@/lib/api";
import { shipmentSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse("Invalid request origin.", 403);
  const session = await apiUser();
  if (!session) return errorResponse("Please sign in.", 401);
  const body = await request.json().catch(() => null);
  const parsed = shipmentSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message);
  const { data, error } = await session.client.from("shipments").insert({ ...parsed.data, created_by: session.user.id }).select("id").single();
  if (error) return errorResponse(error.code === "23505" ? "That shipment reference already exists." : "Unable to save the shipment. Check the workspace connection.", error.code === "23505" ? 409 : 500);
  return NextResponse.json(data, { status: 201 });
}
