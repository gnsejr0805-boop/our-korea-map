import { supabase } from './supabase'

const BUCKET_NAME = 'travel-photos'

const SIGNED_URL_SECONDS =
  60 * 60 * 24 * 7

export const MAX_PHOTO_BYTES =
  5 * 1024 * 1024

const ALLOWED_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

type TravelRecordRow = {
  id: string
  region: string
  place: string
  visited_on: string
  comment: string | null
  photo_path: string | null
  created_at: string
}

export type CloudTravelRecord = {
  id: string
  region: string
  place: string
  date: string
  comment: string
  photoPath: string
  imageUrl: string
  createdAt: string
}

export type NewCloudTravelRecord = {
  region: string
  place: string
  date: string
  comment: string
  photoFile: File | null
}

function convertRow(
  row: TravelRecordRow,
  imageUrl = '',
): CloudTravelRecord {
  return {
    id: row.id,
    region: row.region,
    place: row.place,
    date: row.visited_on,
    comment: row.comment ?? '',
    photoPath: row.photo_path ?? '',
    imageUrl,
    createdAt: row.created_at,
  }
}

function getPhotoExtension(file: File) {
  switch (file.type) {
    case 'image/png':
      return 'png'

    case 'image/webp':
      return 'webp'

    case 'image/jpeg':
    default:
      return 'jpg'
  }
}

function checkPhoto(file: File) {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    throw new Error(
      'JPG, PNG, WEBP 사진만 저장할 수 있어요.',
    )
  }

  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error(
      '사진 용량은 5MB 이하여야 해요.',
    )
  }
}

async function uploadPhoto(
  file: File,
): Promise<string> {
  checkPhoto(file)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error(
      '로그인 정보를 확인하지 못했어요.',
    )
  }

  const extension = getPhotoExtension(file)

  const fileName =
    `${Date.now()}-` +
    `${crypto.randomUUID()}.` +
    extension

  const photoPath =
    `${user.id}/${fileName}`

  const { error: uploadError } =
    await supabase.storage
      .from(BUCKET_NAME)
      .upload(photoPath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

  if (uploadError) {
    throw new Error(
      `사진 업로드 실패: ${uploadError.message}`,
    )
  }

  return photoPath
}

async function createSignedImageUrl(
  photoPath: string | null,
): Promise<string> {
  if (!photoPath) {
    return ''
  }

  const { data, error } =
    await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(
        photoPath,
        SIGNED_URL_SECONDS,
      )

  if (error) {
    console.error(
      '사진 주소 생성 실패:',
      error.message,
    )

    return ''
  }

  return data.signedUrl
}

export async function fetchTravelRecords(): Promise<
  CloudTravelRecord[]
> {
  const { data, error } = await supabase
    .from('travel_records')
    .select(
      `
        id,
        region,
        place,
        visited_on,
        comment,
        photo_path,
        created_at
      `,
    )
    .order('visited_on', {
      ascending: false,
    })
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    throw new Error(
      `여행 기록 불러오기 실패: ${error.message}`,
    )
  }

  const rows =
    (data ?? []) as TravelRecordRow[]

  return Promise.all(
    rows.map(async (row) => {
      const imageUrl =
        await createSignedImageUrl(
          row.photo_path,
        )

      return convertRow(row, imageUrl)
    }),
  )
}

export async function createTravelRecord(
  input: NewCloudTravelRecord,
): Promise<CloudTravelRecord> {
  let uploadedPhotoPath: string | null = null

  try {
    if (input.photoFile) {
      uploadedPhotoPath =
        await uploadPhoto(input.photoFile)
    }

    const { data, error } = await supabase
      .from('travel_records')
      .insert({
        region: input.region,
        place: input.place,
        visited_on: input.date,
        comment: input.comment || null,
        photo_path: uploadedPhotoPath,
      })
      .select(
        `
          id,
          region,
          place,
          visited_on,
          comment,
          photo_path,
          created_at
        `,
      )
      .single()

    if (error) {
      throw new Error(
        `여행 기록 저장 실패: ${error.message}`,
      )
    }

    const row = data as TravelRecordRow

    const imageUrl =
      await createSignedImageUrl(
        row.photo_path,
      )

    return convertRow(row, imageUrl)
  } catch (error) {
    if (uploadedPhotoPath) {
      const { error: removeError } =
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([uploadedPhotoPath])

      if (removeError) {
        console.error(
          '업로드된 사진 정리 실패:',
          removeError.message,
        )
      }
    }

    throw error
  }
}

export async function deleteTravelRecord(
  record: Pick<
    CloudTravelRecord,
    'id' | 'photoPath'
  >,
): Promise<void> {
  const { error } = await supabase
    .from('travel_records')
    .delete()
    .eq('id', record.id)

  if (error) {
    throw new Error(
      `여행 기록 삭제 실패: ${error.message}`,
    )
  }

  if (!record.photoPath) {
    return
  }

  const { error: removeError } =
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([record.photoPath])

  if (removeError) {
    console.error(
      '삭제된 기록의 사진 정리 실패:',
      removeError.message,
    )
  }
}