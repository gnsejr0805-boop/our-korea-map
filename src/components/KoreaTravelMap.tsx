import { useMemo, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type {
  Feature,
  FeatureCollection,
  Geometry,
} from 'geojson'
import type {
  GeometryCollection,
  Topology,
} from 'topojson-specification'
import sidoRaw from '../data/maps/sido.json?raw'
import sigunguRaw from '../data/maps/sigungu.json?raw'
import type { CloudTravelRecord } from '../lib/travelRecords'
import type {
  MapSelection,
} from '../lib/koreaAdministrativeAreas'

type AdminProperties = {
  CODE: string
  ENG_NM: string
  KOR_NM: string
}

type AdminFeature = Feature<
  Geometry,
  AdminProperties
>

type AdminFeatureCollection =
  FeatureCollection<
    Geometry,
    AdminProperties
  >

type KoreaTravelMapProps = {
  records: CloudTravelRecord[]
  onAddMemory: (
    selection: MapSelection,
  ) => void
  onOpenMemories: () => void
}

const sidoTopology = JSON.parse(
  sidoRaw,
) as Topology

const sigunguTopology = JSON.parse(
  sigunguRaw,
) as Topology

const sidoFeatures = feature(
  sidoTopology,
  sidoTopology.objects
    .sido as GeometryCollection<AdminProperties>,
) as AdminFeatureCollection

const sigunguFeatures = feature(
  sigunguTopology,
  sigunguTopology.objects
    .sigungu as GeometryCollection<AdminProperties>,
) as AdminFeatureCollection

const shortProvinceNames: Record<
  string,
  string
> = {
  충청북: '충북',
  충청남: '충남',
  전라북: '전북',
  전라남: '전남',
  경상북: '경북',
  경상남: '경남',
}

const legacyRegionGroups: Record<
  string,
  string[]
> = {
  충청: ['충북', '충남', '대전', '세종'],
  전라: ['전북', '전남', '광주'],
  경상: ['경북', '경남', '대구'],
}

function normalizeSidoName(name: string) {
  const withoutSuffix = name.replace(
    /특별자치시|특별자치도|특별시|광역시|도$/u,
    '',
  )

  return (
    shortProvinceNames[withoutSuffix] ??
    withoutSuffix
  )
}

function recordMatchesSido(
  recordRegion: string,
  sidoName: string,
) {
  if (
    recordRegion === sidoName ||
    normalizeSidoName(recordRegion) === sidoName
  ) {
    return true
  }

  return (
    legacyRegionGroups[recordRegion]?.includes(
      sidoName,
    ) ?? false
  )
}

function getFeatureName(
  mapFeature: AdminFeature,
) {
  return mapFeature.properties.KOR_NM
}

export default function KoreaTravelMap({
  records,
  onAddMemory,
  onOpenMemories,
}: KoreaTravelMapProps) {
  const [selectedSido, setSelectedSido] =
    useState<AdminFeature | null>(null)

  const [selectedSigungu, setSelectedSigungu] =
    useState<AdminFeature | null>(null)

  const selectedSidoPrefix =
    selectedSido?.properties.CODE.slice(0, 2) ??
    ''

  const visibleCollection = useMemo(() => {
    if (!selectedSidoPrefix) {
      return sidoFeatures
    }

    return {
      type: 'FeatureCollection',
      features: sigunguFeatures.features.filter(
        (mapFeature) =>
          mapFeature.properties.CODE.startsWith(
            selectedSidoPrefix,
          ),
      ),
    } as AdminFeatureCollection
  }, [selectedSidoPrefix])

  const mapPath = useMemo(() => {
    const collection =
      visibleCollection.features.length > 0
        ? visibleCollection
        : sidoFeatures

    const projection = geoMercator().fitExtent(
      [
        [18, 18],
        [502, 602],
      ],
      collection,
    )

    return geoPath(projection)
  }, [visibleCollection])

  const selectedSidoName = selectedSido
    ? normalizeSidoName(
        selectedSido.properties.KOR_NM,
      )
    : ''

  const selectedSigunguName =
    selectedSigungu?.properties.KOR_NM ??
    ''

  const selectedSidoRecordCount =
    selectedSidoName
      ? records.filter((record) =>
          recordMatchesSido(
            record.region,
            selectedSidoName,
          ),
        ).length
      : 0

  const returnToNationwideMap = () => {
    setSelectedSido(null)
    setSelectedSigungu(null)
  }

  const selectSido = (mapFeature: AdminFeature) => {
    setSelectedSido(mapFeature)
    setSelectedSigungu(null)
  }

  return (
    <div className="map-preview two-level-map">
      <div className="drill-map-area">
        <div className="drill-map-toolbar">
          {selectedSido ? (
            <button
              className="drill-map-back"
              type="button"
              onClick={returnToNationwideMap}
            >
              ‹ 전국 지도
            </button>
          ) : (
            <span className="drill-map-step">
              1단계
            </span>
          )}

          <div>
            <span>현재 지도</span>

            <strong>
              {selectedSido
                ? `${selectedSido.properties.KOR_NM} 시·군·구`
                : '대한민국 17개 시·도'}
            </strong>
          </div>
        </div>

        <svg
          className={
            selectedSido
              ? 'drill-map-svg detail'
              : 'drill-map-svg nationwide'
          }
          viewBox="0 0 520 620"
          role="img"
          aria-label={
            selectedSido
              ? `${selectedSido.properties.KOR_NM} 시군구 지도`
              : '대한민국 시도 지도'
          }
        >
          {visibleCollection.features.map(
            (mapFeature) => {
              const isNationwide = !selectedSido

              const areaName = isNationwide
                ? normalizeSidoName(
                    mapFeature.properties.KOR_NM,
                  )
                : getFeatureName(mapFeature)

              const visitedCount = isNationwide
                ? records.filter((record) =>
                    recordMatchesSido(
                      record.region,
                      areaName,
                    ),
                  ).length
                : 0

              const isSelected = isNationwide
                ? false
                : selectedSigungu?.properties.CODE ===
                  mapFeature.properties.CODE

              const shapeClassName = [
                'drill-map-shape',
                visitedCount > 0 ? 'visited' : '',
                isSelected ? 'selected' : '',
              ]
                .filter(Boolean)
                .join(' ')

              const selectArea = () => {
                if (isNationwide) {
                  selectSido(mapFeature)
                } else {
                  setSelectedSigungu(mapFeature)
                }
              }

              const centroid =
                mapPath.centroid(mapFeature)

              return (
                <g
                  className="drill-map-region"
                  role="button"
                  tabIndex={0}
                  key={
                    mapFeature.properties.CODE
                  }
                  aria-label={
                    visitedCount > 0
                      ? `${areaName}, 추억 ${visitedCount}개`
                      : areaName
                  }
                  onClick={selectArea}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' ||
                      event.key === ' '
                    ) {
                      event.preventDefault()
                      selectArea()
                    }
                  }}
                >
                  <title>{areaName}</title>

                  <path
                    className={shapeClassName}
                    d={mapPath(mapFeature) ?? ''}
                  />

                  {!isNationwide && (
                    <text
                      className="district-map-label"
                      x={centroid[0]}
                      y={centroid[1]}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {areaName}
                    </text>
                  )}
                </g>
              )
            },
          )}
        </svg>

        {selectedSido ? (
          <>
            <p className="map-tap-guide">
              작은 구·군은 아래 목록에서도
              선택할 수 있어요
            </p>

            <div className="sigungu-chip-grid">
              {visibleCollection.features.map(
                (mapFeature) => {
                  const isSelected =
                    selectedSigungu?.properties.CODE ===
                    mapFeature.properties.CODE

                  return (
                    <button
                      className={
                        isSelected
                          ? 'sigungu-chip selected'
                          : 'sigungu-chip'
                      }
                      type="button"
                      key={
                        mapFeature.properties.CODE
                      }
                      onClick={() => {
                        setSelectedSigungu(
                          mapFeature,
                        )
                      }}
                    >
                      {mapFeature.properties.KOR_NM}
                    </button>
                  )
                },
              )}
            </div>
          </>
        ) : (
          <p className="map-tap-guide">
            시·도를 누르면 시·군·구 지도로
            확대돼요
          </p>
        )}
      </div>

      <div className="map-region-panel">
        {selectedSigungu && selectedSido ? (
          <>
            <span className="selected-region-icon">
              📌
            </span>

            <span className="selected-region-label">
              선택한 세부지역
            </span>

            <strong>
              {selectedSidoName}
              <br />
              {selectedSigungu.properties.KOR_NM}
            </strong>

            <p>
              이 지역에 다녀온 추억을
              <br />
              새로 남겨보세요.
            </p>

            <button
              className="selected-region-action"
              type="button"
              onClick={() => {
                onAddMemory({
                  region: selectedSidoName,
                  district:
                    selectedSigunguName,
                })
              }}
            >
              이 지역에 추억 남기기
            </button>
          </>
        ) : selectedSido ? (
          <>
            <span className="selected-region-icon">
              🗺️
            </span>

            <span className="selected-region-label">
              상세 지도
            </span>

            <strong>
              {selectedSido.properties.KOR_NM}
            </strong>

            <p>
              {visibleCollection.features.length}개
              시·군·구 중에서
              <br />
              한 곳을 선택해보세요.
            </p>

            {selectedSidoRecordCount > 0 && (
              <button
                className="selected-region-action"
                type="button"
                onClick={onOpenMemories}
              >
                기존 추억 보기
              </button>
            )}
          </>
        ) : records.length === 0 ? (
          <>
            <span className="selected-region-icon">
              📍
            </span>

            <strong>
              아직 남긴 여행이 없어요
            </strong>

            <p>
              전국 지도에서 시·도를
              <br />
              선택해보세요.
            </p>
          </>
        ) : (
          <>
            <span className="selected-region-icon">
              💗
            </span>

            <strong>
              벌써 {records.length}개의
              <br />
              추억을 남겼어요!
            </strong>

            <p>
              분홍색 시·도는
              <br />
              함께 다녀온 곳이에요.
            </p>
          </>
        )}
      </div>
    </div>
  )
}