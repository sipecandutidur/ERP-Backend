import { Request, Response } from 'express';
import prisma from '../prisma';
import { PipelineStage, ProjectStatus } from '@prisma/client';

export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        customer: {
          include: {
            organization: true,
          }
        },
        rab: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const mappedProjects = projects.map(project => ({
      ...project,
      initialCapital: project.rab?.totalEstimatedCost || project.initialCapital
    }));

    res.status(200).json({ status: 'success', data: { projects: mappedProjects } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            organization: true,
          }
        },
        rab: true // include to get totalEstimatedCost for Initial Capital
      },
    });

    if (!project) {
      res.status(404).json({ status: 'error', message: 'Project not found' });
      return;
    }

    // Map initialCapital to be the RAB's totalEstimatedCost if available
    const projectResponse = {
      ...project,
      initialCapital: project.rab?.totalEstimatedCost || project.initialCapital
    };

    res.status(200).json({ status: 'success', data: { project: projectResponse } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createProject = async (req: Request, res: Response): Promise<void> => {
  const { spkNumber, name, status, customerId, value, initialCapital } = req.body;

  if (!spkNumber || !name || !customerId) {
    res.status(400).json({ status: 'error', message: 'SPK Number, Name, and Customer are required' });
    return;
  }

  try {
    // Generate Project Code: PRJ-YYMM-XXXX
    const count = await prisma.project.count();
    const projectCode = `PRJ-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(count + 1).toString().padStart(4, '0')}`;

    const project = await prisma.project.create({
      data: {
        code: projectCode,
        spkNumber,
        name,
        status: status as ProjectStatus || 'PENDING',
        customerId,
        value: Number(value) || 0,
        initialCapital: Number(initialCapital) || 0,
      },
      include: {
        customer: {
          include: {
            organization: true,
          }
        }
      }
    });

    res.status(201).json({ status: 'success', data: { project } });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ status: 'error', message: 'SPK Number already exists' });
    } else {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
};

export const updateProject = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { spkNumber, name, status, customerId, value, initialCapital } = req.body;

  try {
    const project = await prisma.project.update({
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

    res.status(200).json({ status: 'success', data: { project } });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ status: 'error', message: 'SPK Number already exists' });
    } else {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
};

export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };

  try {
    await prisma.project.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getProjectDocuments = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        quotations: true,
        documents: true, // Fetch manual documents
      }
    }) as any;

    if (!project) {
       res.status(404).json({ status: 'error', message: 'Project not found' });
       return;
    }

    const projectCode = project.code;

    // Vendor Quotations linked by projectCode
    const vendorQuotations = projectCode ? await prisma.vendorQuotation.findMany({
      where: { projectCode }
    }) : [];

    // Purchase Orders linked by projectCode
    const purchaseOrders = projectCode ? await prisma.purchaseOrder.findMany({
      where: { projectCode }
    }) : [];

    // Delivery Notes linked by Quotation.projectId
    const deliveryNotes = await prisma.deliveryNote.findMany({
      where: {
        quotation: {
          projectId: id
        }
      }
    });

    // Invoices linked by Quotation.projectId or CustomerId
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { quotation: { projectId: id } },
          // Note: In a real system, we'd need a firmer way to link invoice to project if not via quotation
        ]
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        quotations: project.quotations,
        vendorQuotations,
        purchaseOrders,
        deliveryNotes,
        invoices,
        manualDocuments: project.documents,
      }
    });

  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const uploadProjectDocument = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { name, type } = req.body;

  if (!req.file) {
    res.status(400).json({ status: 'error', message: 'No file uploaded' });
    return;
  }

  try {
    const fileUrl = `/uploads/projects/${req.file.filename}`;
    const document = await prisma.projectDocument.create({
      data: {
        projectId: id,
        name: name || req.file.originalname,
        fileUrl,
        type: type || req.file.mimetype,
      }
    });

    res.status(201).json({ status: 'success', data: { document } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const deleteProjectDocument = async (req: Request, res: Response): Promise<void> => {
  const { docId } = req.params as { docId: string };

  try {
    await prisma.projectDocument.delete({
      where: { id: docId }
    });
    // In a production environment, you would also use fs.unlink to delete the actual file

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ==========================================
// PIPELINE (KANBAN)
// ==========================================

const PIPELINE_STAGES: PipelineStage[] = ['BARU', 'BERKUALIFIKASI', 'PROPOSISI', 'BERHASIL', 'REJECT'];

export const getPipelineProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        customer: {
          include: { organization: true },
        },
      },
      orderBy: [
        { pipelineStage: 'asc' },
        { stageOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Group projects by pipeline stage
    const pipeline: Record<PipelineStage, typeof projects> = {
      BARU: [],
      BERKUALIFIKASI: [],
      PROPOSISI: [],
      BERHASIL: [],
      REJECT: [],
    };

    for (const project of projects) {
      pipeline[project.pipelineStage].push(project);
    }

    res.status(200).json({ status: 'success', data: { pipeline, stages: PIPELINE_STAGES } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateProjectStage = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { pipelineStage, stageOrder } = req.body;

  if (!pipelineStage || !PIPELINE_STAGES.includes(pipelineStage)) {
    res.status(400).json({ status: 'error', message: 'Invalid pipeline stage' });
    return;
  }

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        pipelineStage: pipelineStage as PipelineStage,
        stageOrder: stageOrder !== undefined ? Number(stageOrder) : undefined,
      },
      include: {
        customer: { include: { organization: true } },
      },
    });

    res.status(200).json({ status: 'success', data: { project } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
