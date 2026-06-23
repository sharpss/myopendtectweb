import { Router, type Request, type Response } from 'express';

const router = Router();

const availableAttributes = [
  {
    id: 'amplitude',
    name: '振幅属性',
    description: '计算地震道的振幅统计属性',
    params: [
      { name: 'windowSize', label: '时窗大小', type: 'number', default: 50, unit: 'ms' },
      { name: 'attributeType', label: '属性类型', type: 'select', options: ['最大振幅', '最小振幅', '平均振幅', '均方根振幅', '总能量'], default: '均方根振幅' },
    ],
  },
  {
    id: 'coherence',
    name: '相干体',
    description: '检测地层不连续性，识别断层和河道',
    params: [
      { name: 'algorithm', label: '算法', type: 'select', options: ['C1', 'C2', 'C3', '本征结构'], default: 'C3' },
      { name: 'inlineWindow', label: 'Inline 时窗', type: 'number', default: 3, unit: '道' },
      { name: 'crosslineWindow', label: 'Crossline 时窗', type: 'number', default: 3, unit: '道' },
      { name: 'timeWindow', label: '时间时窗', type: 'number', default: 40, unit: 'ms' },
    ],
  },
  {
    id: 'curvature',
    name: '曲率属性',
    description: '描述地层弯曲程度，识别裂缝和褶皱',
    params: [
      { name: 'curvatureType', label: '曲率类型', type: 'select', options: ['最大正曲率', '最小负曲率', '高斯曲率', '平均曲率', '形状指数'], default: '最大正曲率' },
      { name: 'smoothingRadius', label: '平滑半径', type: 'number', default: 5, unit: '道' },
    ],
  },
  {
    id: 'instantaneous_phase',
    name: '瞬时相位',
    description: '复地震道的相位信息',
    params: [],
  },
  {
    id: 'instantaneous_frequency',
    name: '瞬时频率',
    description: '相位对时间的导数',
    params: [],
  },
];

router.get('/list', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: availableAttributes,
  });
});

router.post('/calculate', (req: Request, res: Response) => {
  const { datasetId, attributeType, params = {} } = req.body;
  
  if (!datasetId || !attributeType) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: datasetId, attributeType',
    });
  }
  
  const attribute = availableAttributes.find(a => a.id === attributeType);
  if (!attribute) {
    return res.status(400).json({
      success: false,
      error: `Unknown attribute type: ${attributeType}`,
    });
  }
  
  const attributeId = `attr-${Date.now()}`;
  
  res.json({
    success: true,
    attributeId,
    attributeType,
    datasetId,
    params,
    message: `Started calculating ${attribute.name}`,
    estimatedTime: '5-30 seconds',
  });
});

router.get('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  
  res.json({
    success: true,
    attributeId: id,
    status: 'completed',
    progress: 100,
    result: {
      minValue: -1,
      maxValue: 1,
      dataSize: '100x120x200',
    },
  });
});

export default router;
