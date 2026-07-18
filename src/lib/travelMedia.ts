import { Upload } from 'tus-js-client'
import { supabase } from './supabase'

const BUCKET_NAME = 'travel-media'

const SIGNED_URL_SECONDS =
  60 * 60 * 24 * 7

const TUS_CHUNK_BYTES =
  6 * 1024 * 1024

export const MAX_MEDIA_FILES = 10

export const MAX_IMAGE_BYTES =
  10 * 1024 * 1024

export const MAX_VIDEO_BYTES =
  50 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
]

export type TravelMediaType =
  | 'image'
  | 'video'

type TravelMediaRow = {
  id: string
  record_id: string
  media_type: TravelMediaType
  storage_path: string
  mime_type: string
  original_name: string
  sort_order: number
  created_at: string
}

export type CloudTravelMedia = {
  id: string
  recordId: string
  mediaType: TravelMediaType
  storagePath: string
  mimeType: string
  originalName: string
  sortOrder: number
  url: string
  createdAt: string
}

export type MediaUploadProgress = {
  fileIndex: number
  totalFiles: number
  fileName: string
  percentage: number
}

function convertRow(
  row: TravelMediaRow,
  url = '',
): CloudTravelMedia {
  return {
    id: row.id,
    recordId: row.record_id,
    mediaType: row.media_type,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    originalName: row.original_name,
    sortOrder: row.sort_order,
    url,
    createdAt: row.created_at,
  }
}

export function getTravelMediaType(
  file: File,
): TravelMediaType {
  if (
    ALLOWED_IMAGE_TYPES.includes(file.type)
  ) {
    return 'image'
  }

  if (
    ALLOWED_VIDEO_TYPES.includes(file.type)
  ) {
    return 'video'
  }

  throw new Error(
    'JPG, PNG, WEBP 사진과 MP4, MOV, WEBM 동영상만 저장할 수 있어요.',
  )
}

export function validateTravelMediaFiles(
  files: File[],
) {
  if (files.length > MAX_MEDIA_FILES) {
    throw new Error(
      `사진과 동영상은 합쳐서 최대 ${MAX_MEDIA_FILES}개까지 선택할 수 있어요.`,
    )
  }

  for (const file of files) {
    const mediaType =
      getTravelMediaType(file)

    if (
      mediaType === 'image' &&
      file.size > MAX_IMAGE_BYTES
    ) {
      throw new Error(
        `${file.name}: 사진은 10MB 이하여야 해요.`,
      )
    }

    if (
      mediaType === 'video' &&
      file.size > MAX_VIDEO_BYTES
    ) {
      throw new Error(
        `${file.name}: 동영상은 50MB 이하여야 해요.`,
      )
    }
  }
}

function getFileExtension(file: File) {
  const extensionFromName = file.name
    .split('.')
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  if (extensionFromName) {
    return extensionFromName
  }

  const extensionByType: Record<
    string,
    string
  > = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  }

  return (
    extensionByType[file.type] ??
    'bin'
  )
}

function getTusEndpoint() {
  const projectUrl =
    import.meta.env.VITE_SUPABASE_URL

  if (!projectUrl) {
    throw new Error(
      'Supabase 프로젝트 주소가 없습니다.',
    )
  }

  const projectReference =
    new URL(projectUrl)
      .hostname
      .split('.')[0]

  if (!projectReference) {
    throw new Error(
      'Supabase 프로젝트 주소를 확인해주세요.',
    )
  }

  return (
    `https://${projectReference}` +
    '.storage.supabase.co' +
    '/storage/v1/upload/resumable'
  )
}

async function createSignedMediaUrl(
  storagePath: string,
) {
  const { data, error } =
    await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(
        storagePath,
        SIGNED_URL_SECONDS,
      )

  if (error) {
    console.error(
      '미디어 주소 생성 실패:',
      error.message,
    )

    return ''
  }

  return data.signedUrl
}

function uploadWithTus(
  file: File,
  storagePath: string,
  accessToken: string,
  onProgress?: (
    percentage: number,
  ) => void,
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      const upload = new Upload(file, {
        endpoint: getTusEndpoint(),

        retryDelays: [
          0,
          3000,
          5000,
          10000,
          20000,
        ],

        headers: {
          authorization:
            `Bearer ${accessToken}`,
        },

        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,

        metadata: {
          bucketName: BUCKET_NAME,
          objectName: storagePath,
          contentType: file.type,
          cacheControl: '3600',
        },

        chunkSize: TUS_CHUNK_BYTES,

        onError: (error) => {
          reject(error)
        },

        onProgress: (
          bytesUploaded,
          bytesTotal,
        ) => {
          const percentage = bytesTotal
            ? Math.round(
                (
                  bytesUploaded /
                  bytesTotal
                ) * 100,
              )
            : 0

          onProgress?.(percentage)
        },

        onSuccess: () => {
          resolve()
        },
      })

      void upload
        .findPreviousUploads()
        .then((previousUploads) => {
          const previousUpload =
            previousUploads.find(
              (candidate) =>
                candidate.metadata
                  .objectName ===
                storagePath,
            )

          if (previousUpload) {
            upload.resumeFromPreviousUpload(
              previousUpload,
            )
          }

          upload.start()
        })
        .catch(reject)
    },
  )
}

export async function fetchTravelMedia(
  recordIds: string[],
): Promise<CloudTravelMedia[]> {
  if (recordIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('travel_record_media')
    .select(
      `
        id,
        record_id,
        media_type,
        storage_path,
        mime_type,
        original_name,
        sort_order,
        created_at
      `,
    )
    .in('record_id', recordIds)
    .order('sort_order', {
      ascending: true,
    })
    .order('created_at', {
      ascending: true,
    })

  if (error) {
    throw new Error(
      `여행 미디어 불러오기 실패: ${error.message}`,
    )
  }

  const rows =
    (data ?? []) as TravelMediaRow[]

  return Promise.all(
    rows.map(async (row) =>
      convertRow(
        row,
        await createSignedMediaUrl(
          row.storage_path,
        ),
      ),
    ),
  )
}

export async function uploadTravelMedia(
  recordId: string,
  files: File[],
  onProgress?: (
    progress: MediaUploadProgress,
  ) => void,
): Promise<CloudTravelMedia[]> {
  validateTravelMediaFiles(files)

  if (files.length === 0) {
    return []
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session) {
    throw new Error(
      '로그인 정보를 확인하지 못했어요.',
    )
  }

  const uploadedPaths: string[] = []
  const insertedIds: string[] = []

  const createdMedia:
    CloudTravelMedia[] = []

  try {
    for (
      let index = 0;
      index < files.length;
      index += 1
    ) {
      const file = files[index]

      const mediaType =
        getTravelMediaType(file)

      const extension =
        getFileExtension(file)

      const storagePath =
        `${session.user.id}/` +
        `${recordId}/` +
        `${Date.now()}-` +
        `${crypto.randomUUID()}.` +
        extension

      await uploadWithTus(
        file,
        storagePath,
        session.access_token,
        (percentage) => {
          onProgress?.({
            fileIndex: index,
            totalFiles: files.length,
            fileName: file.name,
            percentage,
          })
        },
      )

      uploadedPaths.push(storagePath)

      const { data, error } =
        await supabase
          .from('travel_record_media')
          .insert({
            record_id: recordId,
            media_type: mediaType,
            storage_path: storagePath,
            mime_type: file.type,
            original_name: file.name,
            sort_order: index,
          })
          .select(
            `
              id,
              record_id,
              media_type,
              storage_path,
              mime_type,
              original_name,
              sort_order,
              created_at
            `,
          )
          .single()

      if (error) {
        throw new Error(
          `미디어 정보 저장 실패: ${error.message}`,
        )
      }

      const row =
        data as TravelMediaRow

      insertedIds.push(row.id)

      createdMedia.push(
        convertRow(
          row,
          await createSignedMediaUrl(
            row.storage_path,
          ),
        ),
      )
    }

    return createdMedia
  } catch (error) {
    if (insertedIds.length > 0) {
      const {
        error: rowCleanupError,
      } = await supabase
        .from('travel_record_media')
        .delete()
        .in('id', insertedIds)

      if (rowCleanupError) {
        console.error(
          '미디어 정보 정리 실패:',
          rowCleanupError.message,
        )
      }
    }

    if (uploadedPaths.length > 0) {
      const {
        error: fileCleanupError,
      } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(uploadedPaths)

      if (fileCleanupError) {
        console.error(
          '업로드된 미디어 정리 실패:',
          fileCleanupError.message,
        )
      }
    }

    throw error
  }
}

export async function deleteTravelMediaFiles(
  recordId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('travel_record_media')
    .select('id, storage_path')
    .eq('record_id', recordId)

  if (error) {
    throw new Error(
      `삭제할 미디어 확인 실패: ${error.message}`,
    )
  }

  const rows = (data ?? []) as Array<{
    id: string
    storage_path: string
  }>

  if (rows.length === 0) {
    return
  }

  const { error: deleteRowsError } =
    await supabase
      .from('travel_record_media')
      .delete()
      .eq('record_id', recordId)

  if (deleteRowsError) {
    throw new Error(
      `미디어 정보 삭제 실패: ${deleteRowsError.message}`,
    )
  }

  const { error: deleteFilesError } =
    await supabase.storage
      .from(BUCKET_NAME)
      .remove(
        rows.map(
          (row) => row.storage_path,
        ),
      )

  if (deleteFilesError) {
    console.error(
      '미디어 파일 정리 실패:',
      deleteFilesError.message,
    )
  }
}
