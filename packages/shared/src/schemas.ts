import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

export const ProjectIdSchema = z.string().uuid();
export const ComponentIdSchema = z.string().uuid();
export const ImageIdSchema = z.string().uuid();
export const WireIdSchema = z.string().uuid();
export const ConnectorIdSchema = z.string().uuid();

export const LengthUnitSchema = z.enum(['mm', 'cm', 'in']);
export const LengthModeSchema = z.enum(['schematic', 'override', 'formula']);
export const StripTypeSchema = z.enum(['full', 'window', 'step']);
export const ImageViewTypeSchema = z.enum([
  'front',
  'rear',
  'side',
  'assembled',
  'installed',
  'datasheet_scan',
  'other',
]);
export const ImageMimeTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);

// ---------------------------------------------------------------------------
// Project metadata (FR-PM-02)
// ---------------------------------------------------------------------------

export const ProjectMetaSchema = z.object({
  id: ProjectIdSchema,
  name: z.string().min(1).max(255),
  description: z.string().max(2000).default(''),
  author: z.string().max(255).default(''),
  schematicVersion: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>;

// ---------------------------------------------------------------------------
// Component image attachment (FR-CL-07 – FR-CL-13)
// ---------------------------------------------------------------------------

export const ComponentImageSchema = z.object({
  id: ImageIdSchema,
  componentId: ComponentIdSchema,
  viewType: ImageViewTypeSchema,
  mimeType: ImageMimeTypeSchema,
  filename: z.string().min(1),
  /** Byte size of the original file */
  sizeBytes: z.number().int().nonnegative(),
  isPrimary: z.boolean().default(false),
  uploadedAt: z.string().datetime(),
  /** Display order within the gallery */
  sortOrder: z.number().int().nonnegative().default(0),
});
export type ComponentImage = z.infer<typeof ComponentImageSchema>;

// ---------------------------------------------------------------------------
// Component STEP file attachment (FR-CL-15 – FR-CL-21)
// ---------------------------------------------------------------------------

export const ComponentStepFileSchema = z.object({
  componentId: ComponentIdSchema,
  filename: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  uploadedAt: z.string().datetime(),
});
export type ComponentStepFile = z.infer<typeof ComponentStepFileSchema>;

// ---------------------------------------------------------------------------
// Component (FR-CL-02 / FR-CL-03)
// ---------------------------------------------------------------------------

export const ConnectorPinSchema = z.object({
  number: z.number().int().positive(),
  label: z.string().max(64).default(''),
  function: z.string().max(128).default(''),
});
export type ConnectorPin = z.infer<typeof ConnectorPinSchema>;

export const ComponentSchema = z.object({
  id: ComponentIdSchema,
  partNumber: z.string().min(1).max(128),
  manufacturer: z.string().max(128).default(''),
  pinCount: z.number().int().positive(),
  pins: z.array(ConnectorPinSchema),
  gender: z.enum(['male', 'female', 'neutral']).default('neutral'),
  description: z.string().max(2000).default(''),
  /** Schematic version at which this component was defined (FR-CL-06) */
  version: z.number().int().nonnegative().default(0),
  images: z.array(ComponentImageSchema).default([]),
  stepFile: ComponentStepFileSchema.nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Component = z.infer<typeof ComponentSchema>;

// ---------------------------------------------------------------------------
// Wire end strip definition (FR-WP-10 / FR-WP-11)
// ---------------------------------------------------------------------------

export const StepStripLayerSchema = z.object({
  label: z.string().max(64).default(''),
  stripLengthMm: z.number().nonnegative(),
});
export type StepStripLayer = z.infer<typeof StepStripLayerSchema>;

export const WireEndSchema = z.object({
  label: z.string().max(64).default(''),
  stripLengthMm: z.number().nonnegative().default(0),
  stripType: StripTypeSchema.default('full'),
  insulationOdMm: z.number().nonnegative().nullable().default(null),
  tinningRequired: z.boolean().default(false),
  tinningLengthMm: z.number().nonnegative().nullable().default(null),
  terminalComponentId: ComponentIdSchema.nullable().default(null),
  terminalInsertionDepthMm: z.number().nonnegative().nullable().default(null),
  notes: z.string().max(2000).default(''),
  /** Sub-table for step strips (FR-WP-12) */
  stepLayers: z.array(StepStripLayerSchema).default([]),
});
export type WireEnd = z.infer<typeof WireEndSchema>;

// ---------------------------------------------------------------------------
// Wire segment (FR-WP-06 / FR-WP-07)
// ---------------------------------------------------------------------------

export const WireSegmentSchema = z.object({
  name: z.string().min(1).max(128),
  lengthMm: z.number().nonnegative(),
  note: z.string().max(500).default(''),
});
export type WireSegment = z.infer<typeof WireSegmentSchema>;

// ---------------------------------------------------------------------------
// Cable end fields — per-end jacket/shield info for multi-conductor cables (FR-WP-15)
// ---------------------------------------------------------------------------

export const ShieldTreatmentSchema = z.enum([
  'fold_back',
  'cut_flush',
  'pigtail',
  'drain_wire_only',
  'none',
]);
export type ShieldTreatment = z.infer<typeof ShieldTreatmentSchema>;

export const CableEndSchema = z.object({
  /** Outer jacket strip length (mm) */
  outerJacketStripLengthMm: z.number().nonnegative().default(0),
  shieldTreatment: ShieldTreatmentSchema.default('none'),
  drainWireLengthMm: z.number().nonnegative().nullable().default(null),
  pigtailLengthMm: z.number().nonnegative().nullable().default(null),
  /** Distance from end at which tape/heat-shrink begins */
  tapeShrinkStartMm: z.number().nonnegative().nullable().default(null),
  tapeShrinkLengthMm: z.number().nonnegative().nullable().default(null),
});
export type CableEnd = z.infer<typeof CableEndSchema>;

// ---------------------------------------------------------------------------
// Project (envelope — contains schematic data)
// ---------------------------------------------------------------------------

export const ProjectSchema = z.object({
  meta: ProjectMetaSchema,
  /** Canvas scale in mm per pixel */
  scaleMmPerPx: z.number().positive().default(1),
  preferredUnit: LengthUnitSchema.default('mm'),
  /** Global routing slack percentage (0–100) applied to schematic/formula lengths */
  routingSlackPct: z.number().min(0).max(100).default(0),
  components: z.array(ComponentSchema).default([]),
  /** Opaque schematic JSON blob — parsed by the schematic editor */
  schematic: z.unknown().default(null),
});
export type Project = z.infer<typeof ProjectSchema>;
