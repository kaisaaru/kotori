import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file");

  const refDir = path.join(process.cwd(), "reference", "kotoba-rumus");

  if (!file) {
    // Return list of available dictionary zip files
    try {
      if (!fs.existsSync(refDir)) {
        return NextResponse.json({ files: [] });
      }
      const files = fs
        .readdirSync(refDir)
        .filter((f) => f.toLowerCase().endsWith(".zip"));
      return NextResponse.json({ files });
    } catch (err) {
      console.error("Error reading reference dir:", err);
      return NextResponse.json({ files: [] });
    }
  }

  // Serve specific dictionary zip file
  const filePath = path.join(refDir, file);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${file}"`,
    },
  });
}
