/** Unique branded ID type to prevent mixing IDs across entities */
export type BrandedId<T extends string> = string & { readonly __brand: T };

export type ProjectId = BrandedId<'Project'>;
export type ComponentId = BrandedId<'Component'>;
export type ImageId = BrandedId<'Image'>;
export type WireId = BrandedId<'Wire'>;
export type ConnectorId = BrandedId<'Connector'>;

export function makeId<T extends string>(): BrandedId<T> {
  return crypto.randomUUID() as BrandedId<T>;
}

/** Unit system for length display */
export type LengthUnit = 'mm' | 'cm' | 'in';

/** Wire length determination mode */
export type LengthMode = 'schematic' | 'override' | 'formula';

/** Strip type for wire end preparation */
export type StripType = 'full' | 'window' | 'step';

/** Image view category for component attachments */
export type ImageViewType =
  | 'front'
  | 'rear'
  | 'side'
  | 'assembled'
  | 'installed'
  | 'datasheet_scan'
  | 'other';

/** Supported image MIME types */
export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/svg+xml';

/** Result type for operations that can fail without throwing */
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
