import { Router, type Request, type Response } from 'express';

const router = Router();

const mockDatasets = [
  {
    id: 'mock-dataset-001',
    name: 'Demo Seismic Volume',
    dimensions: {
      inline: 100,
      crossline: 120,
      time: 200,
    },
    sampleInterval: 4,
    inlineStart: 1000,
    crosslineStart: 2000,
    timeStart: 0,
    source: 'mock',
  },
];

router.get('/datasets', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: mockDatasets,
  });
});

router.get('/datasets/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const dataset = mockDatasets.find(d => d.id === id);
  
  if (!dataset) {
    return res.status(404).json({
      success: false,
      error: 'Dataset not found',
    });
  }
  
  res.json({
    success: true,
    data: dataset,
  });
});

router.get('/slice', (req: Request, res: Response) => {
  const { datasetId, type, index } = req.query;
  
  if (!datasetId || !type || !index) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: datasetId, type, index',
    });
  }
  
  res.json({
    success: true,
    data: {
      datasetId,
      type,
      index: parseInt(index as string),
      message: 'Slice data would be returned here',
    },
  });
});

export default router;
