import { Request, Response } from 'express';
import { ProjectStatus, PipelineStage } from '@prisma/client';
import prisma from '../prisma';
import { logActivity } from '../utils/auditLogger';

export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const projects = await (prisma.project as any).findMany({
      include: {
        customer: {
          select: { name: true },
        },
        rab: {
          select: { totalEstimatedCost: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ status: 'success', data: { projects } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch projects' });
  }
};

export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const project = await (prisma.project as any).findUnique({
      where: { id },
      include: {
        customer: {
          include: { organization: true },
        },
        rab: {
          include: { items: { include: { item: true } } },
        },
      },
    });

    if (!project) {
      res.status(404).json({ status: 'error', message: 'Project not found' });
      return;
    }

    res.status(200).json({ status: 'success', data: { project } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch project' });
  }
};

export const getPipelineProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const projects = await (prisma.project as any).findMany({
      include: {
        customer: { include: { organization: true } },
      },
      orderBy: [
        { stageOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    const pipeline: Record<string, any[]> = {
      BARU: [],
      BERKUALIFIKASI: [],
      PROPOSISI: [],
      BERHASIL: [],
      REJECT: [],
    };

    projects.forEach((project: any) => {
      const stage = project.pipelineStage || 'BARU';
      if (pipeline[stage]) {
        pipeline[stage].push(project);
      }
    });

    res.status(200).json({ status: 'success', data: { pipeline } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch pipeline projects' });
  }
};

export const createProject = async (req: Request | any, res: Response): Promise<void> => {
  const { spkNumber, name, status, customerId, value, initialCapital } = req.body;

  if (!spkNumber || !name || !customerId) {
    res.status(400).json({ status: 'error', message: 'Missing required fields' });
    return;
  }

  try {
    const currentYear = new Date().getFullYear();
    const lastProject = await (prisma.project as any).findFirst({
      where: { code: { startsWith: `PROJ-${currentYear}-` } },
      orderBy: { code: 'desc' },
    });

    let currentSeq = 0;
    if (lastProject && lastProject.code) {
      const parts = lastProject.code.split('-');
      if (parts.length === 3) {
        currentSeq = parseInt(parts[2], 10);
        if (isNaN(currentSeq)) currentSeq = 0;
      }
    }

    const code = `PROJ-${currentYear}-${(currentSeq + 1).toString().padStart(3, '0')}`;

    const project = await (prisma.project as any).create({
      data: {
        code,
        spkNumber,
        name,
        status: status as ProjectStatus,
        customerId,
        value: Number(value) || 0,
        initialCapital: Number(initialCapital) || 0,
      },
      include: {
        customer: { select: { name: true } },
      },
    });

    await logActivity({
      action: 'CREATE',
      entity: 'Project',
      entityId: project.id,
      details: `Project "${project.name}" (Code: ${project.code}) created`,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    res.status(201).json({ status: 'success', data: { project } });
  } catch (error: any) {
    console.error("Create project error:", error);
    if (error.code === 'P2002') {
      res.status(400).json({ status: 'error', message: 'SPK Number already exists' });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Failed to create project' });
  }
};

export const updateProject = async (req: Request | any, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { spkNumber, name, status, customerId, value, initialCapital } = req.body;

  try {
    const project = await (prisma.project as any).update({
      where: { id },
      data: {
        spkNumber,
        name,
        status: status as ProjectStatus,
        customerId,
        value: value !== undefined ? Number(value) : undefined,
        initialCapital: initialCapital !== undefined ? Number(initialCapital) : undefined,
      },
      include: {
        customer: {
          include: {
            organization: true,
          }
        }
      }
    });

    await logActivity({
      action: 'UPDATE',
      entity: 'Project',
      entityId: project.id,
      details: `Project "${project.name}" updated`,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    res.status(200).json({ status: 'success', data: { project } });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ status: 'error', message: 'SPK Number already exists' });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Failed to update project' });
  }
};

export const deleteProject = async (req: Request | any, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };

  try {
    const project = await (prisma.project as any).findUnique({ where: { id } });
    if (!project) {
      res.status(404).json({ status: 'error', message: 'Project not found' });
      return;
    }

    await (prisma.project as any).delete({ where: { id } });

    await logActivity({
      action: 'DELETE',
      entity: 'Project',
      entityId: id,
      details: `Project "${project.name}" deleted`,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to delete project' });
  }
};

export const updateProjectStage = async (req: Request | any, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { pipelineStage, stageOrder } = req.body;

  try {
    const project = await (prisma.project as any).update({
      where: { id },
      data: { 
        pipelineStage: pipelineStage as PipelineStage,
        stageOrder: stageOrder !== undefined ? Number(stageOrder) : undefined
      },
    });

    await logActivity({
      action: 'UPDATE_STAGE',
      entity: 'Project',
      entityId: project.id,
      details: `Project "${project.name}" stage updated to ${pipelineStage}`,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    res.status(200).json({ status: 'success', data: { project } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating project stage' });
  }
};

export const getProjectDocuments = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const project = await (prisma.project as any).findUnique({ where: { id } });
    if (!project) {
      res.status(404).json({ status: 'error', message: 'Project not found' });
      return;
    }

    const manualDocuments = await (prisma as any).projectDocument.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    });

    const quotations = await (prisma as any).quotation.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    });

    const quotationIds = quotations.map((q: any) => q.id);

    const vendorQuotations = await (prisma as any).vendorQuotation.findMany({
      where: { projectCode: project.code },
      orderBy: { createdAt: 'desc' },
    });

    const purchaseOrders = await (prisma as any).purchaseOrder.findMany({
      where: { projectCode: project.code },
      orderBy: { createdAt: 'desc' },
    });

    const deliveryNotes = quotationIds.length > 0 ? await (prisma as any).deliveryNote.findMany({
      where: { quotationId: { in: quotationIds } },
      orderBy: { createdAt: 'desc' },
    }) : [];

    const invoices = quotationIds.length > 0 ? await (prisma as any).invoice.findMany({
      where: { quotationId: { in: quotationIds } },
      orderBy: { createdAt: 'desc' },
    }) : [];

    res.status(200).json({ 
      status: 'success', 
      data: { 
        manualDocuments,
        quotations,
        vendorQuotations,
        purchaseOrders,
        deliveryNotes,
        invoices
      } 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch documents' });
  }
};

export const uploadProjectDocument = async (req: Request | any, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { name, type } = req.body;
  const file = req.file;

  if (!file) {
    res.status(400).json({ status: 'error', message: 'No file uploaded' });
    return;
  }

  try {
    const document = await (prisma as any).projectDocument.create({
      data: {
        projectId: id,
        name: name || file.originalname,
        fileUrl: `/uploads/projects/${file.filename}`,
        type: type || file.mimetype,
      },
    });

    res.status(201).json({ status: 'success', data: { document } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error uploading document' });
  }
};

export const deleteProjectDocument = async (req: Request, res: Response): Promise<void> => {
  const { docId } = req.params as { docId: string };
  try {
    await (prisma as any).projectDocument.delete({ where: { id: docId } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error deleting document' });
  }
};

export const getProjectsCompact = async (req: Request, res: Response): Promise<void> => {
  try {
    const projects = await (prisma.project as any).findMany({
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ status: 'success', data: { projects } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch projects' });
  }
};
