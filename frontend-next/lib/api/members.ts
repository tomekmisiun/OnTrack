import { createAuthedApiClient } from "@/lib/api/auth";
import type { ApiSchema } from "@/lib/api/openapi-helpers";
import {
  parseMember,
  parseMemberList,
  type Member,
} from "@/types/member";

type MemberNameRequest = ApiSchema<"MemberNameRequest">;

function parseMemberResponse(data: unknown): Member {
  const member = parseMember(data);
  if (!member) {
    throw new Error("Invalid member response");
  }
  return member;
}

export async function listMembers(): Promise<Member[]> {
  const data = await createAuthedApiClient().get<unknown>("/api/members/");
  return parseMemberList(data);
}

export async function createMember(name: string): Promise<Member> {
  const body: MemberNameRequest = { name };
  const data = await createAuthedApiClient().post<unknown>(
    "/api/members/",
    body,
  );
  return parseMemberResponse(data);
}

export async function renameMember(
  memberId: number,
  name: string,
): Promise<Member> {
  const body: MemberNameRequest = { name };
  const data = await createAuthedApiClient().patch<unknown>(
    `/api/members/${memberId}`,
    body,
  );
  return parseMemberResponse(data);
}

export async function deleteMember(
  memberId: number,
): Promise<{ message: string }> {
  const data = await createAuthedApiClient().delete<{ message: string }>(
    `/api/members/${memberId}`,
  );
  return data;
}

type MemberProfileRequest = ApiSchema<"MemberProfileRequest">;

export async function saveMemberProfile(
  memberId: number,
  body: MemberProfileRequest,
): Promise<Member> {
  const data = await createAuthedApiClient().patch<unknown>(
    `/api/members/${memberId}/profile`,
    body,
  );
  return parseMemberResponse(data);
}
