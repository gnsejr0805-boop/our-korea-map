import { supabase } from './supabase'

type TravelWishlistRow = {
  id: string
  destination: string
  target_date: string | null
  memo: string
  is_completed: boolean
  created_at: string
}

export type CloudWishlistItem = {
  id: string
  destination: string
  targetDate: string
  memo: string
  isCompleted: boolean
  createdAt: string
}

export type NewWishlistItem = {
  destination: string
  targetDate: string
  memo: string
}

function convertRow(
  row: TravelWishlistRow,
): CloudWishlistItem {
  return {
    id: row.id,
    destination: row.destination,
    targetDate: row.target_date ?? '',
    memo: row.memo ?? '',
    isCompleted: row.is_completed,
    createdAt: row.created_at,
  }
}

function sortWishlistItems(
  items: CloudWishlistItem[],
) {
  return [...items].sort((first, second) => {
    if (
      first.isCompleted !== second.isCompleted
    ) {
      return first.isCompleted ? 1 : -1
    }

    if (
      first.targetDate &&
      second.targetDate
    ) {
      const dateComparison =
        first.targetDate.localeCompare(
          second.targetDate,
        )

      if (dateComparison !== 0) {
        return dateComparison
      }
    }

    if (first.targetDate && !second.targetDate) {
      return -1
    }

    if (!first.targetDate && second.targetDate) {
      return 1
    }

    return second.createdAt.localeCompare(
      first.createdAt,
    )
  })
}

export async function fetchTravelWishlist(): Promise<
  CloudWishlistItem[]
> {
  const { data, error } = await supabase
    .from('travel_wishlist')
    .select(
      `
        id,
        destination,
        target_date,
        memo,
        is_completed,
        created_at
      `,
    )

  if (error) {
    throw new Error(
      `다음 여행 불러오기 실패: ${error.message}`,
    )
  }

  const rows =
    (data ?? []) as TravelWishlistRow[]

  return sortWishlistItems(
    rows.map(convertRow),
  )
}

export async function createWishlistItem(
  input: NewWishlistItem,
): Promise<CloudWishlistItem> {
  const { data, error } = await supabase
    .from('travel_wishlist')
    .insert({
      destination: input.destination,
      target_date:
        input.targetDate || null,
      memo: input.memo,
    })
    .select(
      `
        id,
        destination,
        target_date,
        memo,
        is_completed,
        created_at
      `,
    )
    .single()

  if (error) {
    throw new Error(
      `다음 여행 저장 실패: ${error.message}`,
    )
  }

  return convertRow(
    data as TravelWishlistRow,
  )
}

export async function updateWishlistCompleted(
  id: string,
  isCompleted: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('travel_wishlist')
    .update({
      is_completed: isCompleted,
    })
    .eq('id', id)

  if (error) {
    throw new Error(
      `여행 상태 변경 실패: ${error.message}`,
    )
  }
}

export async function deleteWishlistItem(
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('travel_wishlist')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(
      `다음 여행 삭제 실패: ${error.message}`,
    )
  }
}