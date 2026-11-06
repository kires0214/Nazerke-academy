# JUICY Academy — UI/content/image mapping

## Public shell
- / — hero с IMG_0634.JPG.jpeg (Назерке с Kenwood и насадкой), две CTA «Об академии» и «Войти»; далее что внутри (Kenwood basics, насадки, рецепты, курсы), 3 открытые статьи, короткое о Назерке, настоящие анонсы, информация о доступе, контакты.
- /about — IMG_1889.JPG(1).jpeg (светлый образ, цветы); история без выдуманной биографии.
- /articles — открытые статьи; «Знакомство с Kenwood» = фото Cooking Chef; «Идеальное тесто» = процесс замеса; «Уход за насадками» = насадка/уход. Не показывать закрытые видео.
- /events — реальные открытые анонсы, блюдо/сервировка по программе; без вымышленных дат.
- /contacts — помощь, контакты, политика; без случайной крупной еды.
- Header: JUICY by Nazerke · Главная · Об академии · Статьи · Мастер-классы · Контакты · Войти.

## Closed academy shell
- Desktop header: Главная, Обучение, Рецепты, Мастер-классы, Материалы, JUICY Club, search, avatar.
- Mobile bottom: Главная, Обучение, Рецепты, Встречи, Ещё; поиск и профиль вверху.
- Dashboard welcome IMG_0642.JPG.jpeg; затем Started? Продолжить : Начните здесь; Kenwood/насадки/курсы; новые рецепты; реальные события/новости.
- Profile только аватар: Мои курсы/прогресс, Избранное, Мои записи, Настройки, Выйти. Никаких карточек-дубликатов.
- Обучение → Kenwood с нуля (10 уроков); Насадки; Курсы JUICY; Школа амбассадоров.
- Рецепты → Все рецепты; Кухни мира; Тематические столы; Сбалансированное питание скрыто до заполнения.
- Мастер-классы → Предстоящие, Архив, лист ожидания и городские заявки.
- Материалы → PDFs/books/checklists.
- JUICY Club → FAQ/support/news/offers.
- Школа амбассадоров hero IMG_0640.JPG.jpeg (синий фон), защищённые уроки только после назначения.
- Admin Studio /admin — полностью отдельный layout; отсутствует у ученицы.

## Map original 15 sections
1 dashboard→/academy; 2 Kenwood→learn; 3 attachments→learn; 4 recipes→recipes; 5 courses→learn; 6 world cuisine/themes→recipes collections; 7 nutrition→hidden; 8 archive MC→events archive; 9 upcoming MC→events upcoming; 10 materials→materials; 11 club/help→club; 12 offers→club; 13 news→dashboard feed; 14 about Nazerke→public /about; 15 personal profile→avatar only. Ambassador school as new entitlement-based learning lane.

## Image-to-object invariant

| Content | Asset |
|---|---|
| Cooking Chef | mixer.webp — machine with screen |
| Food Processor | processor.webp |
| KAX400PL cube dicer | dicer.webp |
| KAX980ME roller | roller.webp |
| KAX982ME noodle cutter | cutter.webp |
| KAX950ME food mincer | mincer.webp |
| KAX720PL slow juicer | juicer.webp |
| Blender | blender.webp |
| Dough hook / whisk | hook.webp / whisk.webp |
| Homemade pasta | pasta.webp — prepared pasta |
| Manty | manti.webp |
| Biscuit | biscuit.webp |
| Homemade bread | bread.webp |
| Pizza | pizza.webp |
| Smoothie | smoothie.webp |
| Vegetable salad | salad.webp |
| Soup | soup.webp |
| Dough techniques | dough.webp |
| Cleaning attachment | cleaning.webp |

Equipment card uses equipment photo, recipe card uses finished food, collection card uses a relevant table or menu. One recipe_id reused through multiple collection/attachment/course relationships. All 25 assets recorded in legacy-demo/asset-manifest.json. Validate dimensions and object-fit on mobile and desktop. Never replace owner face by AI, use 4 independent images.

## Visual
Primary #DBADBA; hover #CA96A6; pressed #B98296; background #FAF6F2; surface #FFFDFB; ink #352C31; beige #F1E7DC; blush #F6E7EB. A single hero/photo per intended place, not duplicate.
