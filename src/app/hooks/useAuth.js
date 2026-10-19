"use client";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { members } from "../data/mockData";

export default function useAuth() {
  const { data: session, update } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/");
    },
  });

  return {
    email: session?.user?.email,
    name: session?.user?.name,
    id: session?.user?.id,

    role: session?.user?.role,
    status: session?.user?.status,
    membershipNumber: session?.user?.membershipNumber,

    update,
  };
}
