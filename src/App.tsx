import { useEffect, useState } from 'react'
import type {
  ChangeEvent,
  FormEvent,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import LoginPage from './components/LoginPage'
import WishlistPage from './components/WishlistPage'
import UsPage from './components/UsPage'
import { supabase } from './lib/supabase'
import {
  createTravelRecord,
  deleteTravelRecord,
  fetchTravelRecords,
} from './lib/travelRecords'
import type {
  CloudTravelRecord,
  NewCloudTravelRecord,
} from './lib/travelRecords'

type TabId =
  | 'map'
  | 'memories'
  | 'add'
  | 'wishlist'
  | 'us'

type CompressedPhoto = {
  file: File
  previewUrl: string
}

const regions = [
  '서울',
  '부산',
  '울산',
  '인천',
  '경기',
  '강원',
  '충청',
  '전라',
  '경상',
  '제주',
]

const navigationItems: Array<{
  id: TabId
  icon: string
  label: string
}> = [
  {
    id: 'map',
    icon: '🗺️',
    label: '지도',
  },
  {
    id: 'memories',
    icon: '🖼️',
    label: '추억',
  },
  {
    id: 'add',
    icon: '＋',
    label: '기록',
  },
  {
    id: 'wishlist',
    icon: '♥',
    label: '다음 여행',
  },
  {
    id: 'us',
    icon: '🐥',
    label: '우리',
  },
]

function getErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof Error) {
    return error.message
  }

  return fallbackMessage
}

function sortTravelRecords(
  records: CloudTravelRecord[],
) {
  return [...records].sort((first, second) => {
    const dateComparison =
      second.date.localeCompare(first.date)

    if (dateComparison !== 0) {
      return dateComparison
    }

    return second.createdAt.localeCompare(
      first.createdAt,
    )
  })
}

function compressImage(
  file: File,
): Promise<CompressedPhoto> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const sourceUrl = URL.createObjectURL(file)

    image.onload = () => {
      const maximumWidth = 1200
      const maximumHeight = 1200

      const widthRatio =
        maximumWidth / image.width

      const heightRatio =
        maximumHeight / image.height

      const scale = Math.min(
        widthRatio,
        heightRatio,
        1,
      )

      const newWidth = Math.round(
        image.width * scale,
      )

      const newHeight = Math.round(
        image.height * scale,
      )

      const canvas =
        document.createElement('canvas')

      canvas.width = newWidth
      canvas.height = newHeight

      const context = canvas.getContext('2d')

      if (!context) {
        URL.revokeObjectURL(sourceUrl)

        reject(
          new Error(
            '사진을 처리할 수 없어요.',
          ),
        )

        return
      }

      context.fillStyle = '#ffffff'

      context.fillRect(
        0,
        0,
        newWidth,
        newHeight,
      )

      context.drawImage(
        image,
        0,
        0,
        newWidth,
        newHeight,
      )

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(sourceUrl)

          if (!blob) {
            reject(
              new Error(
                '사진을 압축하지 못했어요.',
              ),
            )

            return
          }

          const originalName =
            file.name.replace(
              /\.[^/.]+$/,
              '',
            ) || 'travel-photo'

          const compressedFile = new File(
            [blob],
            `${originalName}.jpg`,
            {
              type: 'image/jpeg',
              lastModified: Date.now(),
            },
          )

          const previewUrl =
            URL.createObjectURL(
              compressedFile,
            )

          resolve({
            file: compressedFile,
            previewUrl,
          })
        },
        'image/jpeg',
        0.76,
      )
    }

    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl)

      reject(
        new Error(
          '사진을 불러오지 못했어요.',
        ),
      )
    }

    image.src = sourceUrl
  })
}

type MapHomeProps = {
  records: CloudTravelRecord[]
  onAddMemory: () => void
  onOpenMemories: () => void
}

function MapHome({
  records,
  onAddMemory,
  onOpenMemories,
}: MapHomeProps) {
  const visitedRegions = new Set(
    records.map((record) => record.region),
  )

  const photoCount = records.filter(
    (record) => record.imageUrl,
  ).length

  const stats = [
    {
      icon: '📍',
      value: visitedRegions.size,
      label: '다녀온 지역',
    },
    {
      icon: '📷',
      value: photoCount,
      label: '저장한 사진',
    },
    {
      icon: '💌',
      value: records.length,
      label: '여행 기록',
    },
  ]

  return (
    <>
      <section className="hero-card">
        <span className="paper-tape" />

        <div className="hero-copy">
          <span className="small-label">
            오늘의 우리
          </span>

          <h2>
            누나와 함께한 곳을
            <br />
            하나씩 담아보자!
          </h2>

          <p>
            사진과 한마디를 남기며
            <br />
            둘만의 여행지도를 완성해요.
          </p>
        </div>

        <div className="character-picture">
          <img
            src={`${import.meta.env.BASE_URL}images/mascots/mascot-map-planning.png`}
            alt="지도를 펼쳐 놓고 함께 여행을 계획하는 오리와 다람쥐"
          />
        </div>
      </section>
      <section className="map-card">
        <div className="section-heading">
          <div>
            <span className="small-label">
              우리의 발자국
            </span>

            <h2>한국 여행지도</h2>
          </div>

          <button
            className="text-button"
            type="button"
            onClick={onOpenMemories}
          >
            전체 보기
          </button>
        </div>

        <div className="map-preview">
          <div className="region-grid">
            {regions.map((region) => {
              const isVisited =
                visitedRegions.has(region)

              return (
                <button
                  className={
                    isVisited
                      ? 'region-chip visited'
                      : 'region-chip'
                  }
                  type="button"
                  key={region}
                >
                  <span>{region}</span>

                  {isVisited && (
                    <span
                      className="region-heart"
                      aria-label="방문 완료"
                    >
                      ♥
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="empty-message">
            {records.length === 0 ? (
              <>
                <span className="empty-pin">
                  📍
                </span>

                <strong>
                  아직 남긴 여행이 없어요
                </strong>

                <p>
                  첫 추억을 등록하면
                  <br />
                  이곳에 하트가 생겨요.
                </p>
              </>
            ) : (
              <>
                <span className="empty-pin">
                  💗
                </span>

                <strong>
                  벌써 {records.length}개의
                  <br />
                  추억을 남겼어요!
                </strong>

                <p>
                  하트가 있는 지역은
                  <br />
                  함께 다녀온 곳이에요.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="stats-section">
        {stats.map((stat) => (
          <article
            className="stat-card"
            key={stat.label}
          >
            <span className="stat-icon">
              {stat.icon}
            </span>

            <strong>{stat.value}</strong>

            <span className="stat-label">
              {stat.label}
            </span>
          </article>
        ))}
      </section>

      <button
        className="add-memory-button"
        type="button"
        onClick={onAddMemory}
      >
        <span className="add-icon">＋</span>

        <span className="add-copy">
          <strong>
            {records.length === 0
              ? '첫 추억 기록하기'
              : '새로운 추억 기록하기'}
          </strong>

          <small>
            장소, 사진, 한마디를 남겨요
          </small>
        </span>

        <span className="button-arrow">›</span>
      </button>
    </>
  )
}

type MemoriesPageProps = {
  records: CloudTravelRecord[]
  onAddMemory: () => void
  onDeleteMemory: (
    record: CloudTravelRecord,
  ) => Promise<void>
}

function MemoriesPage({
  records,
  onAddMemory,
  onDeleteMemory,
}: MemoriesPageProps) {
  const [deletingRecordId, setDeletingRecordId] =
    useState('')

  const [deleteError, setDeleteError] =
    useState('')

  const handleDelete = async (
    record: CloudTravelRecord,
  ) => {
    const shouldDelete = window.confirm(
      `“${record.place}” 추억을 삭제할까요?\n삭제한 기록은 되돌릴 수 없어요.`,
    )

    if (!shouldDelete) {
      return
    }

    setDeletingRecordId(record.id)
    setDeleteError('')

    try {
      await onDeleteMemory(record)
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : '여행 기록을 삭제하지 못했어요.',
      )
    } finally {
      setDeletingRecordId('')
    }
  }
  if (records.length === 0) {
    return (
      <section className="tab-page">
        <span className="tab-sticker">
          우리의 추억
        </span>

        <img
          className="empty-memory-mascot"
          src={`${import.meta.env.BASE_URL}images/mascots/mascot-sitting.png`}
          alt="나란히 앉아 있는 오리와 다람쥐"
        />

        <h2>아직 저장된 추억이 없어요</h2>

        <p>
          처음 함께한 장소부터 하나씩
          기록해보면 여기에 사진과 이야기가
          차곡차곡 쌓여요.
        </p>

        <button
          className="empty-action-button"
          type="button"
          onClick={onAddMemory}
        >
          ＋ 첫 추억 남기기
        </button>
      </section>
    )
  }

  return (
    <section className="memories-page">
      <div className="memories-heading">
        <div>
          <span className="small-label">
            우리의 추억
          </span>

          <h2>함께한 순간들</h2>
        </div>

        <button
          className="small-add-button"
          type="button"
          onClick={onAddMemory}
        >
          ＋ 추가
        </button>
      </div>

      {deleteError && (
        <p className="memory-delete-error">
          {deleteError}
        </p>
      )}

      <div className="memory-list">
        {records.map((record) => (
          <article
            className="memory-card"
            key={record.id}
          >
            {record.imageUrl ? (
              <div className="memory-photo">
                <img
                  src={record.imageUrl}
                  alt={`${record.place}에서 남긴 추억`}
                />
              </div>
            ) : (
              <div className="memory-photo-placeholder">
                <span>📷</span>
                <small>사진 없음</small>
              </div>
            )}

            <div className="memory-card-body">
              <div className="memory-card-heading">
                <div className="memory-meta">
                  <span className="memory-region">
                    📍 {record.region}
                  </span>

                  <time dateTime={record.date}>
                    {record.date}
                  </time>
                </div>

                <button
                  className="memory-delete-button"
                  type="button"
                  disabled={
                    deletingRecordId === record.id
                  }
                  onClick={() => {
                    void handleDelete(record)
                  }}
                  aria-label={`${record.place} 추억 삭제`}
                >
                  {deletingRecordId === record.id
                    ? '삭제 중...'
                    : '삭제'}
                </button>
              </div>

              <h3>{record.place}</h3>

              {record.comment ? (
                <p>{record.comment}</p>
              ) : (
                <p className="empty-comment">
                  아직 한마디가 없어요.
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

type AddMemoryFormProps = {
  onSave: (
    record: NewCloudTravelRecord,
  ) => Promise<void>
  onCancel: () => void
}

function AddMemoryForm({
  onSave,
  onCancel,
}: AddMemoryFormProps) {
  const [region, setRegion] = useState('')
  const [place, setPlace] = useState('')
  const [date, setDate] = useState('')
  const [comment, setComment] = useState('')

  const [photoFile, setPhotoFile] =
    useState<File | null>(null)

  const [imagePreview, setImagePreview] =
    useState('')

  const [fileInputKey, setFileInputKey] =
    useState(0)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [isSaving, setIsSaving] =
    useState(false)

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  const removeSelectedPhoto = () => {
    setPhotoFile(null)
    setImagePreview('')

    setFileInputKey(
      (currentKey) => currentKey + 1,
    )
  }

  const handleImageChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget
    const file = input.files?.[0]

    setErrorMessage('')

    if (!file) {
      removeSelectedPhoto()
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrorMessage(
        '사진 파일만 선택할 수 있어요.',
      )

      input.value = ''
      return
    }

    const maximumOriginalSize =
      10 * 1024 * 1024

    if (file.size > maximumOriginalSize) {
      setErrorMessage(
        '10MB 이하 사진을 선택해주세요.',
      )

      input.value = ''
      return
    }

    try {
      const compressedPhoto =
        await compressImage(file)

      setPhotoFile(compressedPhoto.file)

      setImagePreview(
        compressedPhoto.previewUrl,
      )
    } catch (error) {
      console.error(
        '사진 압축 중 오류가 발생했습니다.',
        error,
      )

      setErrorMessage(
        getErrorMessage(
          error,
          '사진을 불러오지 못했어요.',
        ),
      )

      input.value = ''
    }
  }

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (isSaving) {
      return
    }

    const trimmedPlace = place.trim()
    const trimmedComment = comment.trim()

    if (!region) {
      setErrorMessage(
        '다녀온 지역을 선택해주세요.',
      )
      return
    }

    if (!trimmedPlace) {
      setErrorMessage(
        '장소 이름을 입력해주세요.',
      )
      return
    }

    if (!date) {
      setErrorMessage(
        '여행 날짜를 선택해주세요.',
      )
      return
    }

    setErrorMessage('')
    setIsSaving(true)

    try {
      await onSave({
        region,
        place: trimmedPlace,
        date,
        comment: trimmedComment,
        photoFile,
      })
    } catch (error) {
      console.error(
        '여행 기록 저장 중 오류가 발생했습니다.',
        error,
      )

      setErrorMessage(
        getErrorMessage(
          error,
          '추억을 저장하지 못했어요.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="record-form-page">
      <div className="form-heading">
        <span className="small-label">
          새로운 기록
        </span>

        <h2>오늘의 추억을 남겨볼까요?</h2>

        <p>
          다녀온 장소와 사진, 둘만의
          한마디를 차근차근 적어주세요.
        </p>
      </div>

      <form
        className="memory-form"
        onSubmit={handleSubmit}
      >
        <label className="form-field">
          <span className="field-label">
            지역
            <strong>필수</strong>
          </span>

          <select
            value={region}
            disabled={isSaving}
            onChange={(event) => {
              setRegion(event.target.value)
              setErrorMessage('')
            }}
          >
            <option value="">
              지역을 선택해주세요
            </option>

            {regions.map((regionName) => (
              <option
                value={regionName}
                key={regionName}
              >
                {regionName}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="field-label">
            장소 이름
            <strong>필수</strong>
          </span>

          <input
            type="text"
            value={place}
            placeholder="예: 광안리 해수욕장"
            maxLength={40}
            disabled={isSaving}
            onChange={(event) => {
              setPlace(event.target.value)
              setErrorMessage('')
            }}
          />

          <small className="field-help">
            식당, 카페, 관광지 등 자유롭게
            적어도 돼요.
          </small>
        </label>

        <label className="form-field">
          <span className="field-label">
            여행 날짜
            <strong>필수</strong>
          </span>

          <input
            type="date"
            value={date}
            disabled={isSaving}
            onChange={(event) => {
              setDate(event.target.value)
              setErrorMessage('')
            }}
          />
        </label>

        <div className="form-field">
          <span className="field-label">
            대표 사진
            <em>선택</em>
          </span>

          <label className="photo-upload">
            <input
              key={fileInputKey}
              type="file"
              accept="image/*"
              disabled={isSaving}
              onChange={handleImageChange}
            />

            {imagePreview ? (
              <img
                src={imagePreview}
                alt="선택한 사진 미리보기"
              />
            ) : (
              <span className="photo-upload-empty">
                <strong>📷</strong>
                <span>사진 선택하기</span>
                <small>
                  10MB 이하 사진 1장
                </small>
              </span>
            )}
          </label>

          {imagePreview && (
            <button
              className="remove-photo-button"
              type="button"
              disabled={isSaving}
              onClick={removeSelectedPhoto}
            >
              선택한 사진 지우기
            </button>
          )}
        </div>

        <label className="form-field">
          <span className="field-label">
            우리의 한마디
            <em>선택</em>
          </span>

          <textarea
            value={comment}
            placeholder="예: 누나가 처음 한국 바다를 본 날 💗"
            maxLength={200}
            rows={5}
            disabled={isSaving}
            onChange={(event) => {
              setComment(event.target.value)
            }}
          />

          <small className="character-count">
            {comment.length} / 200
          </small>
        </label>

        {errorMessage && (
          <p
            className="form-error"
            role="alert"
          >
            ⚠️ {errorMessage}
          </p>
        )}

        <div className="form-actions">
          <button
            className="cancel-button"
            type="button"
            disabled={isSaving}
            onClick={onCancel}
          >
            취소
          </button>

          <button
            className="save-button"
            type="submit"
            disabled={isSaving}
          >
            {isSaving
              ? '클라우드에 저장 중...'
              : '추억 저장하기'}
          </button>
        </div>
      </form>
    </section>
  )
}
function App() {
  const [session, setSession] =
    useState<Session | null>(null)

  const [
    isCheckingSession,
    setIsCheckingSession,
  ] = useState(true)

  const [activeTab, setActiveTab] =
    useState<TabId>('map')

  const [records, setRecords] = useState<
    CloudTravelRecord[]
  >([])

  const [
    isLoadingRecords,
    setIsLoadingRecords,
  ] = useState(false)

  const [recordsError, setRecordsError] =
    useState('')

  const [reloadKey, setReloadKey] =
    useState(0)

  const currentUserId = session?.user.id

  useEffect(() => {
    let isMounted = true

    const checkSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      setSession(currentSession)
      setIsCheckingSession(false)
    }

    void checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!isMounted) {
          return
        }

        setSession(nextSession)
        setIsCheckingSession(false)
      },
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    if (!currentUserId) {
      setRecords([])
      setRecordsError('')
      setIsLoadingRecords(false)
      return
    }

    const loadRecords = async () => {
      setRecordsError('')
      setIsLoadingRecords(true)

      try {
        const cloudRecords =
          await fetchTravelRecords()

        if (isCancelled) {
          return
        }

        setRecords(
          sortTravelRecords(cloudRecords),
        )
      } catch (error) {
        console.error(
          '클라우드 기록을 불러오지 못했습니다.',
          error,
        )

        if (isCancelled) {
          return
        }

        setRecordsError(
          getErrorMessage(
            error,
            '여행 기록을 불러오지 못했어요.',
          ),
        )
      } finally {
        if (!isCancelled) {
          setIsLoadingRecords(false)
        }
      }
    }

    void loadRecords()

    return () => {
      isCancelled = true
    }
  }, [currentUserId, reloadKey])

  const handleLoginSuccess = async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()

    setSession(currentSession)
  }

  const saveRecord = async (
    newRecord: NewCloudTravelRecord,
  ) => {
    const savedRecord =
      await createTravelRecord(newRecord)

    setRecords((currentRecords) =>
      sortTravelRecords([
        savedRecord,
        ...currentRecords,
      ]),
    )

    setActiveTab('memories')
  }

  const removeRecord = async (
    record: CloudTravelRecord,
  ) => {
    await deleteTravelRecord(record)

    setRecords((currentRecords) =>
      currentRecords.filter(
        (currentRecord) =>
          currentRecord.id !== record.id,
      ),
    )
  }

  const renderActiveTab = () => {
    if (isLoadingRecords) {
      return (
        <section className="tab-page">
          <span className="tab-main-icon">
            ☁️
          </span>

          <h2>추억을 불러오는 중...</h2>

          <p>
            둘만의 클라우드 여행일기를
            확인하고 있어요.
          </p>
        </section>
      )
    }

    if (recordsError) {
      return (
        <section className="tab-page">
          <span className="tab-main-icon">
            🥲
          </span>

          <h2>추억을 불러오지 못했어요</h2>

          <p>{recordsError}</p>

          <button
            className="empty-action-button"
            type="button"
            onClick={() => {
              setReloadKey(
                (currentKey) =>
                  currentKey + 1,
              )
            }}
          >
            다시 불러오기
          </button>
        </section>
      )
    }

    switch (activeTab) {
      case 'map':
        return (
          <MapHome
            records={records}
            onAddMemory={() => {
              setActiveTab('add')
            }}
            onOpenMemories={() => {
              setActiveTab('memories')
            }}
          />
        )

      case 'memories':
        return (
          <MemoriesPage
            records={records}
            onAddMemory={() => {
              setActiveTab('add')
            }}
            onDeleteMemory={removeRecord}
          />
        )

      case 'add':
        return (
          <AddMemoryForm
            onSave={saveRecord}
            onCancel={() => {
              setActiveTab('map')
            }}
          />
        )

      case 'wishlist':
  return <WishlistPage />
      case 'us':
  return <UsPage records={records} />
      default:
        return null
    }
  }

  if (isCheckingSession) {
    return (
      <main className="login-page">
        <section className="login-card">
          <p>
            우리 여행지도를 불러오는 중...
          </p>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
      />
    )
  }

  return (
    <main className="page">
      <section className="app-shell">
        <header className="top-bar">
          <button
            className="round-button"
            type="button"
            aria-label="메뉴 열기"
          >
            ☰
          </button>

          <div className="title-area">
            <span className="title-kicker">
              우리 둘만의 여행일기
            </span>

            <h1>
              우리의 한국지도
              <span className="title-heart">
                ♥
              </span>
            </h1>
          </div>

          <button
            className="round-button"
            type="button"
            aria-label="가고 싶은 곳"
            onClick={() => {
              setActiveTab('wishlist')
            }}
          >
            ♡
          </button>
        </header>

        <div className="app-content">
          {renderActiveTab()}
        </div>

        <nav className="bottom-navigation">
          {navigationItems.map((item) => {
            const isActive =
              item.id === activeTab

            return (
              <button
                className={
                  isActive
                    ? 'navigation-item active'
                    : 'navigation-item'
                }
                type="button"
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                }}
                aria-current={
                  isActive ? 'page' : undefined
                }
              >
                <span className="navigation-icon">
                  {item.icon}
                </span>

                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </section>
    </main>
  )
}

export default App
