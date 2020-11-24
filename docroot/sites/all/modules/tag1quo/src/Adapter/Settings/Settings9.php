<?php

namespace Drupal\tag1quo\Adapter\Settings;

use Drupal\Core\Site\Settings as CoreSettings;

/**
 * Class Settings9.
 *
 * @internal This class is subject to change.
 */
class Settings9 extends Settings {

  /**
   * {@inheritdoc}
   */
  public function get($name, $default = NULL) {
    return CoreSettings::get($name, $default);
  }

}
