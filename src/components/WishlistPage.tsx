import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { FormEvent } from 'react'
import {
  createWishlistItem,
  deleteWishlistItem,
  fetchTravelWishlist,
  updateWishlistCompleted,
} from '../lib/travelWishlist'
import type {
  CloudWishlistItem,
} from '../lib/travelWishlist'

function getErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof Error) {
    return error.message
  }

  return fallbackMessage
}

function calculateDday(targetDate: string) {
  if (!targetDate) {
    return ''
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(
    `${targetDate}T00:00:00`,
  )

  const difference =
    target.getTime() - today.getTime()

  const days = Math.ceil(
    difference / (1000 * 60 * 60 * 24),
  )

  if (days === 0) {
    return 'D-DAY'
  }

  if (days > 0) {
    return `D-${days}`
  }

  return `D+${Math.abs(days)}`
}

function sortItems(
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
      return first.targetDate.localeCompare(
        second.targetDate,
      )
    }

    if (first.targetDate) {
      return -1
    }

    if (second.targetDate) {
      return 1
    }

    return second.createdAt.localeCompare(
      first.createdAt,
    )
  })
}

function WishlistPage() {
  const [items, setItems] = useState<
    CloudWishlistItem[]
  >([])

  const [destination, setDestination] =
    useState('')

  const [targetDate, setTargetDate] =
    useState('')

  const [memo, setMemo] = useState('')

  const [isLoading, setIsLoading] =
    useState(true)

  const [isSaving, setIsSaving] =
    useState(false)

  const [errorMessage, setErrorMessage] =
    useState('')

  useEffect(() => {
    let isMounted = true

    const loadWishlist = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const loadedItems =
          await fetchTravelWishlist()

        if (isMounted) {
          setItems(loadedItems)
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            getErrorMessage(
              error,
              '다음 여행을 불러오지 못했어요.',
            ),
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadWishlist()

    return () => {
      isMounted = false
    }
  }, [])

  const sortedItems = useMemo(
    () => sortItems(items),
    [items],
  )

  const upcomingCount = items.filter(
    (item) => !item.isCompleted,
  ).length

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    const trimmedDestination =
      destination.trim()

    if (!trimmedDestination) {
      setErrorMessage(
        '가고 싶은 여행지를 적어주세요.',
      )
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      const newItem =
        await createWishlistItem({
          destination:
            trimmedDestination,
          targetDate,
          memo: memo.trim(),
        })

      setItems((currentItems) =>
        sortItems([
          newItem,
          ...currentItems,
        ]),
      )

      setDestination('')
      setTargetDate('')
      setMemo('')
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          '다음 여행을 저장하지 못했어요.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleCompletedChange = async (
    item: CloudWishlistItem,
  ) => {
    const nextCompleted =
      !item.isCompleted

    setErrorMessage('')

    try {
      await updateWishlistCompleted(
        item.id,
        nextCompleted,
      )

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                isCompleted:
                  nextCompleted,
              }
            : currentItem,
        ),
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          '여행 상태를 바꾸지 못했어요.',
        ),
      )
    }
  }

  const handleDelete = async (
    item: CloudWishlistItem,
  ) => {
    const shouldDelete = window.confirm(
      `${item.destination} 계획을 삭제할까요?`,
    )

    if (!shouldDelete) {
      return
    }

    setErrorMessage('')

    try {
      await deleteWishlistItem(item.id)

      setItems((currentItems) =>
        currentItems.filter(
          (currentItem) =>
            currentItem.id !== item.id,
        ),
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          '여행 계획을 삭제하지 못했어요.',
        ),
      )
    }
  }

  return (
    <section className="wishlist-page">
      <div className="wishlist-heading">
        <span className="tab-sticker">
          다음 여행
        </span>

        <h2>누나와 어디로 갈까?</h2>

        <p>
          가고 싶은 곳과 함께 하고 싶은 일을
          하나씩 모아봐요.
        </p>

        <div className="wishlist-summary">
          <span>💗</span>
          <strong>
            기다리는 여행 {upcomingCount}개
          </strong>
        </div>
      </div>

      <form
        className="wishlist-form"
        onSubmit={handleSubmit}
      >
        <label>
          <span>가고 싶은 곳</span>

          <input
            type="text"
            value={destination}
            onChange={(event) => {
              setDestination(
                event.target.value,
              )
            }}
            placeholder="예: 부산 해운대"
            maxLength={60}
          />
        </label>

        <label>
          <span>예정일</span>

          <input
            type="date"
            value={targetDate}
            onChange={(event) => {
              setTargetDate(
                event.target.value,
              )
            }}
          />
        </label>

        <label>
          <span>하고 싶은 일</span>

          <textarea
            value={memo}
            onChange={(event) => {
              setMemo(event.target.value)
            }}
            placeholder="예: 요트 타고 야경 보기"
            maxLength={300}
            rows={3}
          />
        </label>

        <button
          className="wishlist-save-button"
          type="submit"
          disabled={isSaving}
        >
          {isSaving
            ? '저장하는 중...'
            : '하트 여행지 저장'}
        </button>
      </form>

      {errorMessage && (
        <p className="wishlist-error">
          {errorMessage}
        </p>
      )}

      {isLoading ? (
        <div className="wishlist-empty">
          다음 여행을 불러오는 중...
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="wishlist-empty">
          <span>🧳</span>
          <strong>
            아직 저장한 여행지가 없어요
          </strong>
          <p>
            둘이 함께 가고 싶은 곳을
            처음으로 적어봐요.
          </p>
        </div>
      ) : (
        <div className="wishlist-list">
          {sortedItems.map((item) => (
            <article
              className={
                item.isCompleted
                  ? 'wishlist-card is-completed'
                  : 'wishlist-card'
              }
              key={item.id}
            >
              <div className="wishlist-card-top">
                <button
                  className="wishlist-check-button"
                  type="button"
                  onClick={() => {
                    void handleCompletedChange(
                      item,
                    )
                  }}
                  aria-label={
                    item.isCompleted
                      ? '여행 완료 취소'
                      : '여행 완료 표시'
                  }
                >
                  {item.isCompleted
                    ? '✓'
                    : '♡'}
                </button>

                <div className="wishlist-card-title">
                  <h3>
                    {item.destination}
                  </h3>

                  {item.targetDate && (
                    <span>
                      {calculateDday(
                        item.targetDate,
                      )}
                    </span>
                  )}
                </div>

                <button
                  className="wishlist-delete-button"
                  type="button"
                  onClick={() => {
                    void handleDelete(item)
                  }}
                  aria-label="여행 계획 삭제"
                >
                  ×
                </button>
              </div>

              {item.targetDate && (
                <p className="wishlist-date">
                  📅 {item.targetDate}
                </p>
              )}

              {item.memo && (
                <p className="wishlist-memo">
                  {item.memo}
                </p>
              )}

              {item.isCompleted && (
                <span className="wishlist-completed-label">
                  함께 다녀왔어요
                </span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default WishlistPage