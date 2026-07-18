import { useEffect, useRef, useState } from 'react'
import type {
  ChangeEvent,
  FormEvent,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import LoginPage from './components/LoginPage'
import WishlistPage from './components/WishlistPage'
import UsPage from './components/UsPage'
import KoreaTravelMap from './components/KoreaTravelMap'
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
import {
  getTravelMediaType,
  MAX_IMAGE_BYTES,
  MAX_MEDIA_FILES,
  MAX_VIDEO_BYTES,
} from './lib/travelMedia'
import type {
  TravelMediaType,
} from './lib/travelMedia'
import {
  districtsByRegion,
} from './lib/koreaAdministrativeAreas'
import type {
  MapSelection,
} from './lib/koreaAdministrativeAreas'

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

type SelectedMedia = {
  id: string
  file: File
  previewUrl: string
  mediaType: TravelMediaType
}

type LightboxPhoto = {
  id: string
  url: string
  alt: string
}

const regions = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
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
  onAddMemory: (
    selection?: MapSelection,
  ) => void
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

        <KoreaTravelMap
          records={records}
          onAddMemory={onAddMemory}
          onOpenMemories={onOpenMemories}
        />
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
        onClick={() => {
          onAddMemory()
        }}
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

  const [lightboxPhotos, setLightboxPhotos] =
    useState<LightboxPhoto[]>([])

  const [lightboxIndex, setLightboxIndex] =
    useState(0)

  const activeLightboxPhoto =
    lightboxPhotos[lightboxIndex] ?? null

  const closeLightbox = () => {
    setLightboxPhotos([])
    setLightboxIndex(0)
  }

  const openRecordPhoto = (
    record: CloudTravelRecord,
    selectedMediaId?: string,
  ) => {
    const photos: LightboxPhoto[] =
      record.media
        .filter(
          (media) =>
            media.mediaType === 'image' &&
            Boolean(media.url),
        )
        .map((media) => ({
          id: media.id,
          url: media.url,
          alt:
            record.place + '에서 남긴 사진',
        }))

    if (
      photos.length === 0 &&
      record.imageUrl
    ) {
      photos.push({
        id: 'legacy-' + record.id,
        url: record.imageUrl,
        alt:
          record.place + '에서 남긴 추억',
      })
    }

    if (photos.length === 0) {
      return
    }

    const selectedIndex = selectedMediaId
      ? photos.findIndex(
          (photo) =>
            photo.id === selectedMediaId,
        )
      : 0

    setLightboxPhotos(photos)
    setLightboxIndex(
      selectedIndex >= 0 ? selectedIndex : 0,
    )
  }

  const showPreviousPhoto = () => {
    setLightboxIndex((currentIndex) =>
      (
        currentIndex -
        1 +
        lightboxPhotos.length
      ) % lightboxPhotos.length,
    )
  }

  const showNextPhoto = () => {
    setLightboxIndex((currentIndex) =>
      (currentIndex + 1) %
      lightboxPhotos.length,
    )
  }

  useEffect(() => {
    if (lightboxPhotos.length === 0) {
      return
    }

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        closeLightbox()
        return
      }

      if (event.key === 'ArrowLeft') {
        setLightboxIndex((currentIndex) =>
          (
            currentIndex -
            1 +
            lightboxPhotos.length
          ) % lightboxPhotos.length,
        )
      }

      if (event.key === 'ArrowRight') {
        setLightboxIndex((currentIndex) =>
          (currentIndex + 1) %
          lightboxPhotos.length,
        )
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.body.style.overflow =
        previousOverflow

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      )
    }
  }, [lightboxPhotos.length])

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
          onClick={() => {
            onAddMemory()
          }}
        >
          ＋ 첫 추억 남기기
        </button>
      </section>
    )
  }

  return (
    <>
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
          onClick={() => {
            onAddMemory()
          }}
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
            {record.media.length > 0 ? (
              <div className="memory-media-gallery">
                {record.media.map((media) => (
                  <div
                    className="memory-media-item"
                    key={media.id}
                  >
                    {media.mediaType === 'image' ? (
                      <button
                        className="memory-image-button"
                        type="button"
                        onClick={() => {
                          openRecordPhoto(
                            record,
                            media.id,
                          )
                        }}
                        aria-label="사진 크게 보기"
                      >
                        <img
                          src={media.url}
                          alt={
                            record.place + '에서 남긴 사진'
                          }
                        />
                      </button>
                    ) : (
                      <video
                        src={media.url}
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )}
                  </div>
                ))}

                {record.media.length > 1 && (
                  <span className="memory-media-count">
                    1 / {record.media.length}
                  </span>
                )}
              </div>
            ) : record.imageUrl ? (
              <div className="memory-photo">
                <button
                  className="memory-image-button"
                  type="button"
                  onClick={() => {
                    openRecordPhoto(record)
                  }}
                  aria-label="사진 크게 보기"
                >
                  <img
                    src={record.imageUrl}
                    alt={
                      record.place + '에서 남긴 추억'
                    }
                  />
                </button>
              </div>
            ) : (
              <div className="memory-photo-placeholder">
                <span>📷</span>
                <small>사진·동영상 없음</small>
              </div>
            )}
            <div className="memory-card-body">
              <div className="memory-card-heading">
                <div className="memory-meta">
                  <span className="memory-region">
                    📍 {record.region}
                    {record.district
                      ? ' · ' + record.district
                      : ''}
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

      {activeLightboxPhoto && (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="사진 크게 보기"
          onClick={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeLightbox()
            }
          }}
        >
          <button
            className="photo-lightbox-close"
            type="button"
            onClick={closeLightbox}
            aria-label="전체화면 닫기"
          >
            ×
          </button>

          {lightboxPhotos.length > 1 && (
            <button
              className="photo-lightbox-navigation previous"
              type="button"
              onClick={showPreviousPhoto}
              aria-label="이전 사진"
            >
              ‹
            </button>
          )}

          <div
            className="photo-lightbox-content"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <img
              src={activeLightboxPhoto.url}
              alt={activeLightboxPhoto.alt}
            />

            <span className="photo-lightbox-counter">
              {lightboxIndex + 1} /
              {lightboxPhotos.length}
            </span>
          </div>

          {lightboxPhotos.length > 1 && (
            <button
              className="photo-lightbox-navigation next"
              type="button"
              onClick={showNextPhoto}
              aria-label="다음 사진"
            >
              ›
            </button>
          )}
        </div>
      )}
    </>
  )
}

type AddMemoryFormProps = {
  onSave: (
    record: NewCloudTravelRecord,
  ) => Promise<void>
  onCancel: () => void
  initialRegion?: string
  initialDistrict?: string
}

function AddMemoryForm({
  onSave,
  onCancel,
  initialRegion = '',
  initialDistrict = '',
}: AddMemoryFormProps) {
  const [region, setRegion] =
    useState(initialRegion)

  const [district, setDistrict] =
    useState(initialDistrict)
  const [place, setPlace] = useState('')
  const [date, setDate] = useState('')
  const [comment, setComment] = useState('')

  const availableDistricts =
    districtsByRegion[region] ?? []

  const [selectedMedia, setSelectedMedia] =
    useState<SelectedMedia[]>([])

  const previewUrlsRef =
    useRef<string[]>([])

  const [fileInputKey, setFileInputKey] =
    useState(0)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [isSaving, setIsSaving] =
    useState(false)

  useEffect(() => {
    const previewUrls =
      previewUrlsRef.current

    return () => {
      for (const previewUrl of previewUrls) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [])

  const removeSelectedMedia = (
    mediaId: string,
  ) => {
    setSelectedMedia((currentMedia) => {
      const removedMedia =
        currentMedia.find(
          (media) => media.id === mediaId,
        )

      if (removedMedia) {
        URL.revokeObjectURL(
          removedMedia.previewUrl,
        )

        previewUrlsRef.current =
          previewUrlsRef.current.filter(
            (previewUrl) =>
              previewUrl !==
              removedMedia.previewUrl,
          )
      }

      return currentMedia.filter(
        (media) => media.id !== mediaId,
      )
    })
  }

  const handleMediaChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget

    const files = Array.from(
      input.files ?? [],
    )

    setErrorMessage('')

    if (files.length === 0) {
      return
    }

    if (
      selectedMedia.length + files.length >
      MAX_MEDIA_FILES
    ) {
      setErrorMessage(
        '사진과 동영상은 합쳐서 최대 ' +
          MAX_MEDIA_FILES +
          '개까지 선택할 수 있어요.',
      )

      input.value = ''
      return
    }

    const nextMedia: SelectedMedia[] = []

    try {
      for (const file of files) {
        const mediaType =
          getTravelMediaType(file)

        let uploadFile = file
        let previewUrl = ''

        if (mediaType === 'image') {
          if (file.size > MAX_IMAGE_BYTES) {
            throw new Error(
              file.name +
                ': 사진은 10MB 이하여야 해요.',
            )
          }

          const compressedPhoto =
            await compressImage(file)

          uploadFile = compressedPhoto.file
          previewUrl =
            compressedPhoto.previewUrl
        } else {
          if (file.size > MAX_VIDEO_BYTES) {
            throw new Error(
              file.name +
                ': 동영상은 50MB 이하여야 해요.',
            )
          }

          previewUrl =
            URL.createObjectURL(file)
        }

        previewUrlsRef.current.push(
          previewUrl,
        )

        nextMedia.push({
          id: crypto.randomUUID(),
          file: uploadFile,
          previewUrl,
          mediaType,
        })
      }

      setSelectedMedia((currentMedia) => [
        ...currentMedia,
        ...nextMedia,
      ])

      setFileInputKey(
        (currentKey) => currentKey + 1,
      )
    } catch (error) {
      for (const media of nextMedia) {
        URL.revokeObjectURL(
          media.previewUrl,
        )

        previewUrlsRef.current =
          previewUrlsRef.current.filter(
            (previewUrl) =>
              previewUrl !==
              media.previewUrl,
          )
      }

      setErrorMessage(
        getErrorMessage(
          error,
          '파일을 불러오지 못했어요.',
        ),
      )
    } finally {
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
        district,
        place: trimmedPlace,
        date,
        comment: trimmedComment,
        photoFile: null,
        mediaFiles: selectedMedia.map(
          (media) => media.file,
        ),
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
              setDistrict('')
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
            시·군·구
            <em>선택</em>
          </span>

          <select
            value={district}
            disabled={isSaving || !region}
            onChange={(event) => {
              setDistrict(event.target.value)
              setErrorMessage('')
            }}
          >
            <option value="">
              {region
                ? '시·군·구를 선택해주세요'
                : '지역을 먼저 선택해주세요'}
            </option>

            {availableDistricts.map(
              (districtName) => (
                <option
                  value={districtName}
                  key={districtName}
                >
                  {districtName}
                </option>
              ),
            )}
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
            사진·동영상
            <em>선택</em>
          </span>

          <label className="photo-upload media-upload">
            <input
              key={fileInputKey}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              disabled={
                isSaving ||
                selectedMedia.length >=
                  MAX_MEDIA_FILES
              }
              onChange={handleMediaChange}
            />

            <span className="photo-upload-empty">
              <strong>🎞️</strong>
              <span>
                사진·동영상 추가하기
              </span>
              <small>
                최대 10개 · 사진 10MB ·
                동영상 50MB
              </small>
            </span>
          </label>

          {selectedMedia.length > 0 && (
            <>
              <div className="selected-media-grid">
                {selectedMedia.map((media) => (
                  <div
                    className="selected-media-item"
                    key={media.id}
                  >
                    {media.mediaType === 'image' ? (
                      <img
                        src={media.previewUrl}
                        alt={media.file.name}
                      />
                    ) : (
                      <video
                        src={media.previewUrl}
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )}

                    <span className="selected-media-type">
                      {media.mediaType === 'image'
                        ? '사진'
                        : '동영상'}
                    </span>

                    <button
                      className="selected-media-remove"
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        removeSelectedMedia(
                          media.id,
                        )
                      }}
                      aria-label={
                        media.file.name + ' 제거'
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <small className="media-selection-count">
                {selectedMedia.length} /
                {MAX_MEDIA_FILES}개 선택됨
              </small>
            </>
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

  const [pendingMapSelection,
    setPendingMapSelection] =
    useState<MapSelection | null>(null)

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

    setPendingMapSelection(null)
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
            onAddMemory={(selection) => {
              setPendingMapSelection(
                selection ?? null,
              )

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
              setPendingMapSelection(null)
              setActiveTab('add')
            }}
            onDeleteMemory={removeRecord}
          />
        )

      case 'add':
        return (
          <AddMemoryForm
            onSave={saveRecord}
            initialRegion={
              pendingMapSelection?.region
            }
            initialDistrict={
              pendingMapSelection?.district
            }
            onCancel={() => {
              setPendingMapSelection(null)
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
                  if (item.id === 'add') {
                    setPendingMapSelection(null)
                  }

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
