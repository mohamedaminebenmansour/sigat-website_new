# -*- coding: utf-8 -*-
import io
P = r'c:\Users\Lenovo\Desktop\sigat-website\src\app\features\projects\components\project-gallery.component.ts'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')

def sub(old, new):
    global s
    if old not in s:
        raise SystemExit('NOT FOUND:\n' + old[:200])
    s = s.replace(old, new, 1)

# 1 imports: drop effect
sub("  computed,\n  effect,\n  inject,", "  computed,\n  inject,")

# 2 consts
sub("const SLOT_TRANSITION_MS = 700;\nconst TRAVEL_MS = 900;", "const TRAVEL_MS = 950;")

# 3 interfaces: SlotDisplay + Traveler -> GalleryCard (splice)
i0 = s.index('interface SlotDisplay {')
i1 = s.index('@Component({')
new_if = """interface GalleryCard {
  key: number;
  src: string;
  /** Visual slot index (0 = primary center). */
  slot: SlotIndex;
  cssClass: string;
  alt: string;
  isCenter: boolean;
}
"""
s = s[:i0] + new_if + s[i1:]

# 4 CSS .pgx-layer transition + add .pgx-flipping (no nesting)
old_layer = """        transform: translateX(-50%) translateY(var(--lift, 0px))
                   rotate(var(--rot, 0deg)) scale(var(--s, 1));
        transition:
          transform 750ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity 550ms ease,
          box-shadow 550ms ease;
        will-change: transform, opacity;
      }"""
new_layer = """        transform: translateX(-50%) translateY(var(--lift, 0px))
                   rotate(var(--rot, 0deg)) scale(var(--s, 1))
                   var(--flip, scale(1) translate(0));
        transition:
          left 750ms cubic-bezier(0.22, 1, 0.36, 1),
          top 750ms cubic-bezier(0.22, 1, 0.36, 1),
          width 750ms cubic-bezier(0.22, 1, 0.36, 1),
          transform 750ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity 550ms ease,
          box-shadow 550ms ease;
        will-change: transform, opacity;
      }
      .pgx-layer.pgx-flipping { transition: none !important; }"""
sub(old_layer, new_layer)

# 5 remove traveler CSS + keyframes + reduced-motion traveler
t0 = s.index("      /* ------------------------------------------------------------------\n       * Secondary -> Primary TRAVEL overlay.")
t1 = s.index("    `,\n  ],\n  template: `")
s = s[:t0] + s[t1:]

# 6 template slots loop + travelers -> single img cards loop
old_tpl = """        @for (slot of displaySlots(); track slot.id) {
          <button
            #slotEl
            type="button"
            [class]="'pgx-layer ' + slot.cssClass"
            (click)="onLayerClick(slot.index)"
            [attr.aria-label]="slot.alt"
            [attr.aria-current]="slot.isCenter ? 'true' : null"
          >
            <span class="pgx-img-stack">
              <img
                [ngSrc]="slot.currentSrc"
                width="1280"
                height="960"
                class="pgx-img pgx-img-a"
                [class.pgx-img-hidden]="slot.showNext"
                [alt]="slot.alt"
                [loading]="slot.isCenter ? 'eager' : 'lazy'"
                [attr.fetchpriority]="slot.isCenter ? 'high' : null"
                (error)="onImgError(slot.currentSrc)"
              />
              <img
                [src]="slot.nextSrc"
                width="1280"
                height="960"
                class="pgx-img pgx-img-b"
                [class.pgx-img-hidden]="!slot.showNext"
                [alt]="slot.alt"
                loading="lazy"
                aria-hidden="true"
                (error)="onImgError(slot.nextSrc)"
              />
            </span>
          </button>
        }
      </div>

      @if (travelers().length) {
        @for (t of travelers(); track t.id) {
          <div
            class="pgx-traveler"
            [class.pgx-traveler--active]="t.active"
            [style.width.px]="t.x"
            [style.height.px]="t.y"
            [style.left.px]="t.left"
            [style.top.px]="t.top"
            [style.z-index]="t.z"
            [style.--tdx]="t.tdx + 'px'"
            [style.--tdy]="t.tdy + 'px'"
            [style.--ts]="t.scale"
            [style.--tf]="t.focusScale"
            [style.animation-delay]="t.delay + 'ms'"
          >
            <img [src]="t.src" [alt]="altText()" draggable="false" />
          </div>
        }
      }"""
new_tpl = """        @for (card of cards(); track card.key) {
          <button
            #slotEl
            type="button"
            [class]="'pgx-layer ' + card.cssClass"
            (click)="onLayerClick(card.slot)"
            [attr.aria-label]="card.alt"
            [attr.aria-current]="card.isCenter ? 'true' : null"
          >
            <img
              [ngSrc]="card.src"
              width="1280"
              height="960"
              class="pgx-img"
              [alt]="card.alt"
              [loading]="card.isCenter ? 'eager' : 'lazy'"
              [attr.fetchpriority]="card.isCenter ? 'high' : null"
              (error)="onImgError(card.src)"
            />
          </button>
        }
      </div>"""
sub(old_tpl, new_tpl) if 'old_tpl' in dir() else sub(old_tpl, new_tpl) if False else old_tpl)
# 7 controls displaySlots -> cards
s = s.replace('@if (disploySlots().length >= 2) {', '@if (cards().length >= 2) {')
s = s.replace('[disabled]="disploySlots().length < 2"', '[disabled]="cards().length < 2"')

# 8 fields
old_f = """  private readonly displayedSrcs = signal<string[]>([]);

  /** Transsition lock (plain field, not a signal): prevents overlapping transitions. */
  private isTransitioning = false;
  private travelTimer: ReturnType<typeof setTimeout> | null = null;
  private travelerId = 0;

  /** Transient secondary<->primary travel overlays rendered in the template. */
  readonly travelers = signal<Traveler[]>([]);

  @ViewChild('stageEl') private stageEl?: ElementRef<HTMLElelement>;
  @ViewChildren('slotEl') private slotEls?: QueryList<ElementRef<HTMLElement>>;"""
new_f = """  /** Transsition lock (plain field, not a signal): prevents overlapping transitions. */
  private isTransitioning = false;
  private travelTimer: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('stageEl') private stageEl?: ElementRef<HTMLElement>;
  @ViewChildren('slotEl') private slotEls?: QueryList<ElementRef<HTMLElement>>;"""
sub(old_f, new_f)

# 9 constructor: drop effect
old_c = """    this.destroyRef.onDestroy(() => {
      this.clearTimer();
      if (this.travelTimer !== null) clearTimeout(this.travelTimer);
    });

    effect(() => {
      const slots = this.disploySlots();
      const hasTransition = slots.some(s => s.showNext);
      if (hasTransition && slots.length > 0) {
        if (this.transsitionTimer) clearTimeout(this.transsitionTimer);
        this.transitionTimer = setTimeout(() => {
          this.disployedSrcs.set(slots.map(s => s.showNext ? s.nextSrc : s.currentSrc));
          this.transitionTimer = null;
        }, SLOT_TRANSITION_MS);
      }
    });"""
new_c = """    this.destroyRef.onDestroy(() => {
      this.clearTimer();
      if (this.travelTimer !== null) clearTimeout(this.travelTimer);
    });"""
sub(old_c, new_c)

# 10 displaySlots computed -> cards computed
old_d = s[s.index('  readonly disploySlots = computed<'):s.index('  readonly counter = computed<')]
new_d = ""  readonly cards = computed<GalleryCard[]>(() => {
    const images = this.galleryImages();
    const n = images.length;
    if (n === 0) return [];

    const off = ((this.offset() % n) + n) % n;
    const count = Math.min(5, n);

    return Array.from({ length: count }, (_, i) => {
      const idx = (off + i) % n;
      return {
        key: idx,
        src: images[idx],
        slot: i as SlotIndex,
        cssClass: SLOT_DEFS[i].cssClass,
        alt: `$this.altText()} ${idx + 1}`,
        isCenter: i === 0,
      };
    });
  });

"""
s = s[:s.index('  readonly disploySlots');] + new_d + s[s.index('  readonly counter = computed<')]

# 11 runTransition core
old_r = """    this.isTransitioning = true;
    this.spawnTravellers(opts.sourceSlot, opts.targetOffset);
    this.offset.set(((opts.targetOffset % n) + n) % n);
    this.scheduleAutoplay(opts.resumeMs);

    if (this.travellTimer !== null) clearTimeout(this.travellTimer);
    this.travellTimer = setTimeout(() => {
      this.travelers.set([]);
      this.isTransitioning = false;
      this.travellTimer = null;
    }, TRAVEL_MS + 60);"""
new_r = """    this.isTransitioning = true;
    this.beginnFlip(opts.targetOffset);
    this.offset.set(((opts.targetOffset % n) + n) % n);
    this.scheduleAutoplay(opts.resumeMs);

    if (this.ravellTimer !== null) clearTimeout(this.ravellTimer);
    this.ravellTimer = setTimeout(() => {
      this.isTransissioning = false;
      this.ravellTimer = null;
      this.clearFlipStyles();
    }, TRAVEL_MS + 80);"""
sub(old_r, new_r)

# 12 replace spawnTravellers + laneRect with bemrnFlip + clearFlipStyles
d0 = s.index('  /**\n   * FLIP-style spatial transition')
d1 = s.index('\n  private scheduleAutoplay')
new_m = NEW_METHODS
s = s[:d0] + new_m + s[d1:]
"""
io.open(P,'w',encoding='utf-8',newline='').write(s.replace('\n', nl))
print('DONE')
