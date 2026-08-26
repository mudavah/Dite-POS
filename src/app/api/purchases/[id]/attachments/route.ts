import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/actions/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
  }

  const body = await request.json();
  const fileName = body.fileName as string;
  const filePath = body.filePath as string;
  const fileSize = body.fileSize as number;
  const mimeType = body.mimeType as string | null;

  const attachment = await prisma.purchaseAttachment.create({
    data: {
      purchaseId: id,
      fileName,
      filePath,
      fileSize,
      mimeType,
      uploadedBy: session.user.id,
    },
  });

  await auditLog({
    userId: session.user.id,
    action: 'PURCHASE_ATTACHMENT_UPLOADED',
    entity: 'PurchaseAttachment',
    entityId: attachment.id,
    newValues: JSON.stringify({ fileName, purchaseId: id }),
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
  });

  return NextResponse.json(attachment, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { attachmentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { attachmentId } = body;
  if (!attachmentId) {
    return NextResponse.json({ error: 'attachmentId is required' }, { status: 400 });
  }

  await prisma.purchaseAttachment.delete({
    where: { id: attachmentId, purchaseId: id },
  });

  await auditLog({
    userId: session.user.id,
    action: 'PURCHASE_ATTACHMENT_DELETED',
    entity: 'PurchaseAttachment',
    entityId: attachmentId,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
  });

  return NextResponse.json({ success: true });
}